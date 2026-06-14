import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../index';

/**
 * Calculate balance for a user in a group
 * Respects membership lifecycle - only includes expenses while member was active
 * 
 * Balance = Total paid by user - Total owed by user
 * Positive = user is owed money
 * Negative = user owes money
 */
export async function calculateUserBalance(
  userId: string,
  groupId: string
): Promise<{ balance: Decimal; breakdown: BalanceBreakdown }> {
  // Get user's membership in group
  const membership = await prisma.groupMember.findUnique({
    where: {
      group_id_user_id: { group_id: groupId, user_id: userId }
    }
  });

  if (!membership) {
    throw new Error('User is not a member of this group');
  }

  // Define date range: from join date to leave date (or now)
  const activeFrom = membership.joined_at;
  const activeTo = membership.left_at || new Date();

  // Get all expenses in this group during user's active period
  const expenses = await prisma.expense.findMany({
    where: {
      group_id: groupId,
      date: {
        gte: activeFrom,
        lte: activeTo
      },
      is_settlement: false // Exclude settlements
    },
    include: {
      paid_by: true,
      splits: true
    }
  });

  let totalPaid = new Decimal(0);
  let totalOwed = new Decimal(0);
  const breakdown: BalanceBreakdown = {
    paid: [],
    owed: []
  };

  for (const expense of expenses) {
    const expenseAmount = new Decimal(expense.amount_original.toString());

    // If user paid this expense
    if (expense.paid_by_id === userId) {
      totalPaid = totalPaid.plus(expenseAmount);
      breakdown.paid.push({
        id: expense.id,
        description: expense.description,
        date: expense.date,
        amount: expenseAmount,
        currency: expense.currency
      });
    }

    // If user owes money for this expense
    const userSplit = expense.splits.find(s => s.user_id === userId);
    if (userSplit && userSplit.amount_owed) {
      const owed = new Decimal(userSplit.amount_owed.toString());
      totalOwed = totalOwed.plus(owed);
      breakdown.owed.push({
        id: expense.id,
        description: expense.description,
        date: expense.date,
        amount: owed,
        currency: expense.currency,
        paidBy: expense.paid_by.first_name + ' ' + expense.paid_by.last_name
      });
    }
  }

  // Include settlements
  const settlementsFrom = await prisma.settlement.findMany({
    where: {
      group_id: groupId,
      from_user_id: userId,
      date: {
        gte: activeFrom,
        lte: activeTo
      }
    }
  });

  const settlementsTo = await prisma.settlement.findMany({
    where: {
      group_id: groupId,
      to_user_id: userId,
      date: {
        gte: activeFrom,
        lte: activeTo
      }
    }
  });

  for (const settlement of settlementsFrom) {
    const amount = new Decimal(settlement.amount.toString());
    totalOwed = totalOwed.plus(amount);
  }

  for (const settlement of settlementsTo) {
    const amount = new Decimal(settlement.amount.toString());
    totalPaid = totalPaid.plus(amount);
  }

  const balance = totalPaid.minus(totalOwed);

  return {
    balance,
    breakdown
  };
}

export interface BalanceBreakdown {
  paid: Array<{
    id: string;
    description: string;
    date: Date;
    amount: Decimal;
    currency: string;
  }>;
  owed: Array<{
    id: string;
    description: string;
    date: Date;
    amount: Decimal;
    currency: string;
    paidBy: string;
  }>;
}

/**
 * Calculate all balances in a group
 * Returns net amounts (who owes whom) for simplicity
 */
export async function calculateGroupBalances(groupId: string): Promise<GroupBalance[]> {
  // Get all members
  const members = await prisma.groupMember.findMany({
    where: { group_id: groupId },
    include: { user: true }
  });

  const balances: Map<string, { user: any; balance: Decimal }> = new Map();

  for (const member of members) {
    const { balance } = await calculateUserBalance(member.user_id, groupId);
    balances.set(member.user_id, {
      user: member.user,
      balance
    });
  }

  return Array.from(balances.values()).map(({ user, balance }) => ({
    userId: user.id,
    userName: `${user.first_name} ${user.last_name}`,
    balance
  }));
}

export interface GroupBalance {
  userId: string;
  userName: string;
  balance: Decimal;
}
