import { prisma } from '../index.js';
import { isDatabaseAvailable } from './database.js';
import {
  createDevUser,
  findDevUserByEmail,
  findDevUserById,
  removeDevUser,
  type DevUser,
} from './devStore.js';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (await isDatabaseAvailable()) {
    return prisma.user.findUnique({ where: { email } });
  }
  return findDevUserByEmail(email);
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (await isDatabaseAvailable()) {
    return prisma.user.findUnique({ where: { id } });
  }
  return findDevUserById(id);
}

export async function createUserRecord(data: {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
}): Promise<UserRecord> {
  if (await isDatabaseAvailable()) {
    return prisma.user.create({ data });
  }

  return createDevUser({
    id: `dev_${Date.now()}`,
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function migrateDevUserToDatabase(email: string): Promise<UserRecord | null> {
  const fileUser = findDevUserByEmail(email);
  if (!fileUser || !(await isDatabaseAvailable())) {
    return null;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    removeDevUser(email);
    return existing;
  }

  const user = await prisma.user.create({
    data: {
      email: fileUser.email,
      password_hash: fileUser.password_hash,
      first_name: fileUser.first_name,
      last_name: fileUser.last_name,
    },
  });

  removeDevUser(email);
  return user;
}

export async function resolveDatabaseUserId(userId: string, email: string): Promise<string | null> {
  if (!(await isDatabaseAvailable())) {
    return userId;
  }

  const byId = await prisma.user.findUnique({ where: { id: userId } });
  if (byId) {
    return byId.id;
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return byEmail.id;
  }

  const migrated = await migrateDevUserToDatabase(email);
  return migrated?.id ?? null;
}
