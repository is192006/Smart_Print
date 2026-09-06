import { NextFunction, Response } from 'express';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

import { AuthenticatedRequest } from '../types/auth.types';
import { UnauthorizedError } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

const BEARER_PREFIX = 'Bearer ';

// Verifies the JWT on the Authorization header and attaches { userId, role }
// to req.user. Does not hit the database - downstream handlers/services
// that need the current status/profile should look the user up themselves.
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    next(new UnauthorizedError('Missing bearer token'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      next(new UnauthorizedError('Token has expired'));
      return;
    }
    if (err instanceof JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
      return;
    }
    next(new UnauthorizedError('Invalid token'));
  }
}
