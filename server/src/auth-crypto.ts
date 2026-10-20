import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);

export async function hashPassword(
  password: string,
  salt = randomBytes(16),
): Promise<{ salt: string; hash: string }> {
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return {
    salt: salt.toString('hex'),
    hash: derivedKey.toString('hex'),
  };
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  hashHex: string,
): Promise<boolean> {
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== 64) {
    return false;
  }
  const supplied = (await scrypt(
    password,
    Buffer.from(saltHex, 'hex'),
    expected.length,
  )) as Buffer;
  return timingSafeEqual(supplied, expected);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
