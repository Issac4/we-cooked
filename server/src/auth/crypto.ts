import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/** URL-safe random token with 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time string comparison (compares hashes so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(sha256(a), 'hex'), Buffer.from(sha256(b), 'hex'));
}

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

// Verified when the username does not exist, so a wrong username takes as long
// as a wrong password and does not reveal which usernames exist.
let dummyHash: Promise<string> | undefined;

export async function verifyPassword(passwordHash: string | undefined, password: string): Promise<boolean> {
  if (!passwordHash) {
    dummyHash ??= hash('not-a-real-password');
    await verify(await dummyHash, password);
    return false;
  }
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
