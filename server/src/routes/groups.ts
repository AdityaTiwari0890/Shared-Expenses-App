import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../lib/auth.js';
import { resolveDatabaseUserId } from '../lib/userService.js';

const router = Router();

router.use(authMiddleware);

// Create group
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, description } = z.object({
      name: z.string().min(1),
      description: z.string().optional()
    }).parse(req.body);

    const userId = await resolveDatabaseUserId(req.user.id, req.user.email);
    if (!userId) {
      res.status(401).json({ error: 'User account not found. Please log out and register again.' });
      return;
    }

    // Create group with creator as member
    const group = await prisma.group.create({
      data: {
        name,
        description,
        created_by_id: userId,
        members: {
          create: {
            user_id: userId,
            joined_at: new Date()
          }
        }
      },
      include: {
        members: { include: { user: true } },
        _count: { select: { expenses: true } }
      }
    });

    res.status(201).json({ success: true, group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  }
});

// Get groups for user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userId = await resolveDatabaseUserId(req.user.id, req.user.email);
    if (!userId) {
      res.status(401).json({ error: 'User account not found. Please log out and register again.' });
      return;
    }

    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: { user_id: userId }
        }
      },
      include: {
        members: { include: { user: true } },
        _count: { select: { expenses: true } }
      }
    });

    res.json({ groups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get group details
router.get('/:groupId', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userId = await resolveDatabaseUserId(req.user.id, req.user.email);
    if (!userId) {
      res.status(401).json({ error: 'User account not found. Please log out and register again.' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: {
        members: { include: { user: true } },
        expenses: { orderBy: { date: 'desc' }, take: 10 }
      }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Check if user is member
    const isMember = group.members.some((m: any) => m.user_id === userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    res.json({ group });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Add member to group
router.post('/:groupId/members', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { user_id } = z.object({
      user_id: z.string()
    }).parse(req.body);

    // Check if requester is group creator
    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: { members: true }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (group.created_by_id !== req.user.id) {
      res.status(403).json({ error: 'Only creator can add members' });
      return;
    }

    // Check if user already member
    const existingMember = group.members.find((m: any) => m.user_id === user_id);
    if (existingMember && !existingMember.left_at) {
      res.status(400).json({ error: 'User is already a member' });
      return;
    }

    // Add member
    const member = await prisma.groupMember.create({
      data: {
        group_id: group.id,
        user_id,
        joined_at: new Date()
      },
      include: { user: true }
    });

    res.status(201).json({ success: true, member });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Add member error:', error);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
});

// Remove member from group (set leave date)
router.post('/:groupId/members/:userId/remove', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check if requester is group creator
    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (group.created_by_id !== req.user.id) {
      res.status(403).json({ error: 'Only creator can remove members' });
      return;
    }

    // Update member (set leave date)
    const member = await prisma.groupMember.update({
      where: {
        group_id_user_id: {
          group_id: group.id,
          user_id: req.params.userId
        }
      },
      data: { left_at: new Date() },
      include: { user: true }
    });

    res.json({ success: true, member });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
