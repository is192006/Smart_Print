import { randomBytes } from 'node:crypto';

// Same style as generateOrderCode() (orderCode.ts): time-sortable prefix +
// a short random suffix, collision-resistant enough that a DB unique-
// constraint violation is treated as a genuine failure rather than retried.
export function generateReference(prefix: string): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${timePart}-${randomPart}`;
}
