import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../index.js';
import { CSVRow, parseDate } from './anomalyDetectionService.js';

const PAYER_DISPLAY_PREFIX = '[payer_display:';

type ActiveMember = {
  user_id: string;
  user: { first_name: string; last_name: string };
};

function findMemberByName(members: ActiveMember[], name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  for (const member of members) {
    const fullName = `${member.user.first_name} ${member.user.last_name}`.toLowerCase();
    const firstName = member.user.first_name.toLowerCase();
    const lastName = member.user.last_name.toLowerCase();
    if (
      fullName === normalized ||
      firstName === normalized ||
      lastName === normalized ||
      fullName.includes(normalized) ||
      normalized.includes(firstName)
    ) {
      return member.user_id;
    }
  }
  return null;
}

function parseAmount(amountStr: string): number {
  return parseFloat(amountStr.replace(/,/g, ''));
}

function parseSplitNames(splitWith: string): string[] | 'ALL' | null {
  const raw = splitWith?.trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  if (['all', 'everyone', 'all people', 'all members', 'friends', 'group', 'all friends'].includes(normalized)) {
    return 'ALL';
  }

  return raw.split(/[,;|&+/]/).map((part) => part.trim()).filter(Boolean);
}

function resolveSplitMemberIds(
  splitWith: string | null | undefined,
  activeMembers: ActiveMember[],
  defaultUserId: string
): string[] {
  const parsed = parseSplitNames(splitWith || '');

  if (parsed === 'ALL') {
    return activeMembers.map((m) => m.user_id);
  }

  if (parsed === null) {
    return [defaultUserId];
  }

  const ids: string[] = [];
  for (const name of parsed) {
    const memberId = findMemberByName(activeMembers, name);
    if (memberId && !ids.includes(memberId)) {
      ids.push(memberId);
    }
  }

  return ids.length > 0 ? ids : [defaultUserId];
}

function buildEqualSplits(memberIds: string[], total: number) {
  const count = memberIds.length;
  if (count === 0) return [];

  const baseShare = Math.floor((total / count) * 100) / 100;
  return memberIds.map((userId, index) => ({
    user_id: userId,
    amount:
      index === count - 1
        ? Math.round((total - baseShare * (count - 1)) * 100) / 100
        : baseShare,
  }));
}

function buildPercentageSplits(
  memberIds: string[],
  total: number,
  splitDetails: string
): Array<{ user_id: string; amount: number; percentage: number }> | null {
  const percentages = (splitDetails.match(/(\d+(?:\.\d+)?)\s*%?/g) || [])
    .map((value) => parseFloat(value))
    .filter((value) => !Number.isNaN(value));

  if (percentages.length !== memberIds.length) {
    return null;
  }

  const splits = memberIds.map((userId, index) => ({
    user_id: userId,
    percentage: percentages[index],
    amount: Math.round(total * (percentages[index] / 100) * 100) / 100,
  }));

  const assigned = splits.reduce((sum, split) => sum + split.amount, 0);
  const diff = Math.round((total - assigned) * 100) / 100;
  if (diff !== 0) {
    splits[splits.length - 1].amount = Math.round((splits[splits.length - 1].amount + diff) * 100) / 100;
  }

  return splits;
}

function buildSplitsFromRow(
  row: CSVRow,
  memberIds: string[],
  total: number
): Array<{ user_id: string; amount: number; percentage?: number }> {
  const splitType = (row.split_type || 'EQUAL').trim().toUpperCase();

  if (splitType === 'PERCENTAGE' && row.split_details?.trim()) {
    const percentageSplits = buildPercentageSplits(memberIds, total, row.split_details);
    if (percentageSplits) return percentageSplits;
  }

  if (splitType === 'EXACT' && row.split_details?.trim()) {
    const amounts = row.split_details
      .split(/[,;|&+/]/)
      .map((part) => parseFloat(part.replace(/[^\d.-]/g, '')))
      .filter((value) => !Number.isNaN(value));

    if (amounts.length === memberIds.length) {
      return memberIds.map((userId, index) => ({
        user_id: userId,
        amount: amounts[index],
      }));
    }
  }

  return buildEqualSplits(memberIds, total);
}

function buildNotes(row: CSVRow, payerDisplayName: string): string | null {
  const userNotes = row.notes?.trim() || '';
  const marker = `${PAYER_DISPLAY_PREFIX}${payerDisplayName}]`;
  const combined = userNotes ? `${marker} ${userNotes}` : marker;
  return combined;
}

export function extractPayerDisplayName(notes: string | null | undefined, fallback: string): string {
  if (!notes) return fallback;
  const match = notes.match(/\[payer_display:([^\]]+)\]/);
  return match?.[1]?.trim() || fallback;
}

export async function importValidRows(
  groupId: string,
  validRows: CSVRow[],
  defaultPayerId: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } },
  });

  if (!group) {
    throw new Error('Group not found');
  }

  const activeMembers = group.members.filter((m) => !m.left_at);
  const defaultMember = activeMembers.find((m) => m.user_id === defaultPayerId);

  if (activeMembers.length === 0 || !defaultMember) {
    throw new Error('Group has no active members');
  }

  const defaultPayerName = `${defaultMember.user.first_name} ${defaultMember.user.last_name}`;

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of validRows) {
    try {
      const amount = parseAmount(row.amount);
      if (Number.isNaN(amount) || amount === 0) {
        skipped++;
        continue;
      }

      const parsedDate = parseDate(row.date) || new Date();
      const currency = (row.currency || 'INR').trim().toUpperCase();
      const payerDisplayName = row.paid_by?.trim() || defaultPayerName;
      const paidById =
        findMemberByName(activeMembers, payerDisplayName) || defaultPayerId;

      const splitMemberIds = resolveSplitMemberIds(row.split_with, activeMembers, defaultPayerId);
      const splitTypeRaw = (row.split_type || 'EQUAL').trim().toUpperCase();
      const splitType =
        splitTypeRaw === 'PERCENTAGE'
          ? 'PERCENTAGE'
          : splitTypeRaw === 'EXACT'
          ? 'EXACT'
          : splitTypeRaw === 'SHARE'
          ? 'SHARE'
          : 'EQUAL';

      const splits = buildSplitsFromRow(row, splitMemberIds, Math.abs(amount));

      await prisma.expense.create({
        data: {
          group_id: groupId,
          paid_by_id: paidById,
          description: row.description.trim(),
          amount_original: new Decimal(Math.abs(amount)),
          currency,
          date: parsedDate,
          split_type: splitType,
          notes: buildNotes(row, payerDisplayName),
          splits: {
            create: splits.map((split) => ({
              user_id: split.user_id,
              amount_owed: new Decimal(split.amount),
              percentage: split.percentage ? new Decimal(split.percentage) : null,
            })),
          },
        },
      });

      imported++;
    } catch (error: any) {
      errors.push(`Failed to import "${row.description}": ${error.message}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

export { buildEqualSplits, findMemberByName, resolveSplitMemberIds, buildSplitsFromRow };
