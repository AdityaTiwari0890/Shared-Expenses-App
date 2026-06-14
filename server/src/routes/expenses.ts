import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../lib/auth.js';
import { calculateUserBalance } from '../services/balanceService.js';

const router = Router();

router.use(authMiddleware);

// Create expense
router.post('/:groupId/expenses', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { description, amount_original, currency, date, split_type, splits_data, notes } = z.object({
      description: z.string().min(1),
      amount_original: z.number().positive(),
      currency: z.string().default('INR'),
      date: z.string(),
      split_type: z.enum(['EQUAL', 'PERCENTAGE', 'EXACT', 'SHARE']),
      splits_data: z.array(z.object({
        user_id: z.string(),
        amount: z.number(),
        percentage: z.number().optional(),
        shares: z.number().optional()
      })),
      notes: z.string().optional()
    }).parse(req.body);

    // Verify group exists and user is member
    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: { members: true }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const userMembership = group.members.find((m: any) => m.user_id === req.user!.id && !m.left_at);
    if (!userMembership) {
      res.status(403).json({ error: 'Not an active member of this group' });
      return;
    }

    // Create expense with splits
    const expense = await prisma.expense.create({
      data: {
        group_id: group.id,
        paid_by_id: req.user.id,
        description,
        amount_original: new Decimal(amount_original),
        currency,
        date: new Date(date),
        split_type,
        notes,
        splits: {
          create: splits_data.map(split => ({
            user_id: split.user_id,
            amount_owed: new Decimal(split.amount),
            percentage: split.percentage ? new Decimal(split.percentage) : null,
            shares: split.shares || null
          }))
        }
      },
      include: { splits: true, paid_by: true }
    });

    res.status(201).json({ success: true, expense });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Create expense error:', error);
      res.status(500).json({ error: 'Failed to create expense' });
    }
  }
});

// Get group expenses
router.get('/:groupId/expenses', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: { members: true }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const userMembership = group.members.find((m: any) => m.user_id === req.user!.id);
    if (!userMembership) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const expenses = await prisma.expense.findMany({
      where: { group_id: group.id },
      include: {
        splits: true,
        paid_by: true
      },
      orderBy: { date: 'desc' }
    });

    res.json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get expense details
router.get('/:groupId/expenses/:expenseId', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const expense = await prisma.expense.findUnique({
      where: { id: req.params.expenseId },
      include: {
        splits: { include: { user: true } },
        paid_by: true,
        group: { include: { members: true } }
      }
    });

    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    // Check membership
    const isMember = expense.group.members.some((m: any) => m.user_id === req.user!.id && !m.left_at);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    res.json({ expense });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Delete expense
router.delete('/:groupId/expenses/:expenseId', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const expense = await prisma.expense.findUnique({
      where: { id: req.params.expenseId },
      include: { group: { include: { members: true } } }
    });

    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    // Only creator can delete
    if (expense.paid_by_id !== req.user.id) {
      res.status(403).json({ error: 'Only creator can delete expense' });
      return;
    }

    await prisma.expense.delete({ where: { id: req.params.expenseId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Get group balances
router.get('/:groupId/balances', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: { members: { include: { user: true } } }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Get balances for all members
    const balances: any[] = [];
    for (const member of group.members) {
      const { balance, breakdown } = await calculateUserBalance(member.user_id, group.id);
      balances.push({
        userId: member.user_id,
        userName: `${member.user.first_name} ${member.user.last_name}`,
        balance: balance.toString(),
        joinedAt: member.joined_at,
        leftAt: member.left_at,
        breakdown
      });
    }

    res.json({ balances });
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// Get user's balance in group (with breakdown)
router.get('/:groupId/my-balance', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { balance, breakdown } = await calculateUserBalance(req.user.id, req.params.groupId);

    res.json({
      userId: req.user.id,
      balance: balance.toString(),
      breakdown
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to calculate balance' });
  }
});

export default router;
