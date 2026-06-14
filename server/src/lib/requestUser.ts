import { AuthRequest } from './auth.js';
import { resolveDatabaseUserId } from './userService.js';

export async function getResolvedUser(
  req: AuthRequest
): Promise<{ id: string; email: string } | null> {
  if (!req.user) {
    return null;
  }

  const id = await resolveDatabaseUserId(req.user.id, req.user.email);
  if (!id) {
    return null;
  }

  return { id, email: req.user.email };
}
