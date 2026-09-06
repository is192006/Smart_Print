import { PrismaClient } from '@prisma/client';

import { env } from './env';

// Single shared PrismaClient instance for the whole backend.
// Import `prisma` from this module instead of creating new PrismaClient()
// instances in controllers/services.
export const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});
