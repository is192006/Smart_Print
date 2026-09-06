import { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import { AppError } from '../utils/errors';

// Centralized error-handling foundation. Typed AppError subclasses (see
// utils/errors.ts) carry their own HTTP status code; anything else is an
// unexpected error and is always reported as a generic 500 with no stack
// trace or internal details leaked to the client.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (env.nodeEnv === 'development') {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}
