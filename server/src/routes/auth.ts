import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { hashPassword, comparePassword, generateToken, authMiddleware, AuthRequest } from '../lib/auth.js';
import {
  createUserRecord,
  findUserByEmail,
  findUserById,
  migrateDevUserToDatabase,
} from '../lib/userService.js';
import { findDevUserByEmail } from '../lib/devStore.js';
import { isDatabaseAvailable } from '../lib/database.js';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(2),
  last_name: z.string().min(2),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name } = RegisterSchema.parse(req.body);

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const password_hash = await hashPassword(password);
    const user = await createUserRecord({
      email,
      password_hash,
      first_name,
      last_name,
    });

    const token = generateToken(user.id, user.email);

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    let user = await findUserByEmail(email);

    if (!user) {
      const fileUser = findDevUserByEmail(email);
      if (!fileUser) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const isFilePasswordValid = await comparePassword(password, fileUser.password_hash);
      if (!isFilePasswordValid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      if (await isDatabaseAvailable()) {
        user = await migrateDevUserToDatabase(email);
      } else {
        user = fileUser;
      }
    } else {
      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.email);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let user = await findUserById(req.user.id);
    if (!user && (await isDatabaseAvailable())) {
      user = await migrateDevUserToDatabase(req.user.email);
    }

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
