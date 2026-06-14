import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../index.js';
import { CSVRow, parseDate } from './anomalyDetectionService.js';

function findMemberByPayerName(
  members: Array<{ user_id: string; user: { first_name: string; last_name: string } }>,
  payerName: string
): string | null {
  const normalized = payerName.trim().toLowerCase();
  if (!normalized) return null;

  for (const member of members) {
    const fullName = `${member.user.first_name} ${member.user.last_name}`.toLowerCase();
    const firstName = member.user.first_name.toLowerCase();
    if (
      fullName === normalized ||
      firstName === normalized ||
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
  const memberIds = activeMembers.map((m) => m.user_id);

  if (memberIds.length === 0) {
    throw new Error('Group has no active members');
  }

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
      const paidById =
        (row.paid_by ? findMemberByPayerName(activeMembers, row.paid_by) : null) ||
        defaultPayerId;

      const splitTypeRaw = (row.split_type || 'EQUAL').trim().toUpperCase();
      const splitType =
        splitTypeRaw === 'PERCENTAGE'
          ? 'PERCENTAGE'
          : splitTypeRaw === 'EXACT'
          ? 'EXACT'
          : splitTypeRaw === 'SHARE'
          ? 'SHARE'
          : 'EQUAL';

      const splits = buildEqualSplits(memberIds, Math.abs(amount));

      await prisma.expense.create({
        data: {
          group_id: groupId,
          paid_by_id: paidById,
          description: row.description.trim(),
          amount_original: new Decimal(Math.abs(amount)),
          currency,
          date: parsedDate,
          split_type: splitType,
          notes: row.notes?.trim() || null,
          splits: {
            create: splits.map((split) => ({
              user_id: split.user_id,
              amount_owed: new Decimal(split.amount),
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
