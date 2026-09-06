import { env } from '../config/env';
import { ValidationError } from './errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertValidEmailFormat(email: string): void {
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError('A valid email address is required');
  }
}

// Enforces the STUDENT-only public registration domain restriction.
// The domain is configurable via ALLOWED_STUDENT_EMAIL_DOMAIN so it is
// never hardcoded outside this single check.
export function assertStudentEmailDomain(email: string): void {
  const domain = env.allowedStudentEmailDomain;
  if (!email.endsWith(`@${domain}`)) {
    throw new ValidationError(`Student registration requires an @${domain} email address`);
  }
}

export function assertValidName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    throw new ValidationError('Name must be between 2 and 100 characters');
  }
}

export function assertValidPhone(phone: unknown): asserts phone is string | undefined {
  if (phone === undefined || phone === null || phone === '') {
    return;
  }
  if (typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim())) {
    throw new ValidationError('Phone number must be a valid number (7-15 digits)');
  }
}

export function assertValidPasswordInput(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length === 0) {
    throw new ValidationError('Password is required');
  }
}

export function assertValidEmailInput(email: unknown): asserts email is string {
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new ValidationError('Email is required');
  }
}
