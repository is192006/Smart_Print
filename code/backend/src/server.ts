import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

async function main(): Promise<void> {
  // Startup database connectivity check.
  await prisma.$connect();
  // eslint-disable-next-line no-console
  console.log('Database connection established.');

  const app = createApp();

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`SmartPrint backend listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start SmartPrint backend:', err);
  process.exit(1);
});
