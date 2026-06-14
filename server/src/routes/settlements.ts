import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../lib/auth';

const router = Router();

router.use(authMiddleware);

// Record settlement
router.post('/:groupId/settle', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { from_user_id, to_user_id, amount, currency, notes } = z.object({
      from_user_id: z.string(),
      to_user_id: z.string(),
      amount: z.number().positive(),
      currency: z.string().default('INR'),
      notes: z.string().optional()
    }).parse(req.body);

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: { members: true }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Check requester is involved in settlement
    if (req.user.id !== from_user_id && req.user.id !== to_user_id) {
      // Allow group admin to record settlement
      if (group.created_by_id !== req.user.id) {
        res.status(403).json({ error: 'Cannot record settlement' });
        return;
      }
    }

    // Create settlement
    const settlement = await prisma.settlement.create({
      data: {
        group_id: group.id,
        from_user_id,
        to_user_id,
        amount: new Decimal(amount),
        currency,
        notes,
        date: new Date()
      },
      include: {
        from_user: true,
        to_user: true
      }
    });

    res.status(201).json({ success: true, settlement });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Settlement error:', error);
      res.status(500).json({ error: 'Failed to record settlement' });
    }
  }
});

// Get settlements for group
router.get('/:groupId/settlements', async (req: AuthRequest, res: Response) => {
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

    const isMember = group.members.some(m => m.user_id === req.user!.id);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const settlements = await prisma.settlement.findMany({
      where: { group_id: group.id },
      include: {
        from_user: true,
        to_user: true
      },
      orderBy: { date: 'desc' }
    });

    res.json({ settlements });
  } catch (error) {
    console.error('Get settlements error:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

// Get user's settlements
router.get('/:groupId/my-settlements', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const settlements = await prisma.settlement.findMany({
      where: {
        group_id: req.params.groupId,
        OR: [
          { from_user_id: req.user.id },
          { to_user_id: req.user.id }
        ]
      },
      include: {
        from_user: true,
        to_user: true
      },
      orderBy: { date: 'desc' }
    });

    res.json({ settlements });
  } catch (error) {
    console.error('Get settlements error:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

export default router;
