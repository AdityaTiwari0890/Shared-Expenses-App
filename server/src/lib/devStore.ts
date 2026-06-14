import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEV_USERS_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'dev_users.json'
);

export interface DevUser {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
}

export function readDevUsers(): DevUser[] {
  try {
    if (!fs.existsSync(DEV_USERS_PATH)) return [];
    const raw = fs.readFileSync(DEV_USERS_PATH, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

export function writeDevUsers(users: DevUser[]): void {
  try {
    fs.writeFileSync(DEV_USERS_PATH, JSON.stringify(users, null, 2));
  } catch {
    // ignore write failures in dev
  }
}

export function findDevUserByEmail(email: string): DevUser | null {
  return readDevUsers().find((u) => u.email === email) || null;
}

export function findDevUserById(id: string): DevUser | null {
  return readDevUsers().find((u) => u.id === id) || null;
}

export function createDevUser(data: DevUser): DevUser {
  const users = readDevUsers();
  users.push(data);
  writeDevUsers(users);
  return data;
}

export function removeDevUser(email: string): void {
  writeDevUsers(readDevUsers().filter((u) => u.email !== email));
}
