import { createHash, randomBytes } from 'node:crypto';

// 32 bytes of CSPRNG output, hex-encoded (64 chars) - long and unpredictable
// enough that guessing/brute-forcing it is infeasible. Never Math.random()
// and never a sequential/predictable id.
const TOKEN_BYTES = 32;

export function generateRawResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

// Only this hash is ever persisted (see PasswordResetToken.tokenHash) - the
// raw token itself never touches the database, so a database read/leak
// alone can never be used to reset a password.
export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
