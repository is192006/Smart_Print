import bcrypt from 'bcryptjs';

import { ValidationError } from './errors';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// Minimum viable password policy: long enough, and not just letters or just
// digits. Intentionally simple for this phase - no special-character rules.
export function validatePasswordPolicy(password: string): void {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new ValidationError('Password must contain at least one letter and one number');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
