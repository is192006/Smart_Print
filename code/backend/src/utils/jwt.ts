import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { UserRole } from '../types/auth.types';

export interface JwtPayload {
  userId: string;
  role: UserRole;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

// Throws jwt.JsonWebTokenError / jwt.TokenExpiredError on invalid or expired
// tokens - the auth middleware is responsible for turning those into 401s.
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
