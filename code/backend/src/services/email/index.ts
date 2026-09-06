import { env } from '../../config/env';
import { DevConsoleEmailService } from './devConsoleEmail.service';
import { EmailService } from './email.service';
import { SmtpEmailService } from './smtpEmail.service';

export { EmailMessage, EmailService } from './email.service';

function buildEmailService(): EmailService {
  const { host, port, user, password } = env.email;
  if (host && port && user && password) {
    return new SmtpEmailService({ host, port, user, password, from: env.email.from });
  }

  // No SMTP transport configured. This is a normal, expected state in local
  // development/tests (see DevConsoleEmailService) - but never in
  // production, where silently "succeeding" without ever delivering an
  // email would be indistinguishable from a real outage.
  if (env.nodeEnv === 'production') {
    throw new Error(
      'Email is not configured (EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASSWORD): ' +
        'password reset emails cannot be sent in production without a real transport.',
    );
  }

  return new DevConsoleEmailService();
}

// A single lazily-constructed instance, matching the existing
// services/storage/index.ts singleton pattern. Built once per process
// (not per request) - constructing a fresh nodemailer transporter on every
// forgot-password call would be wasteful, and the production
// misconfiguration check above should fail fast at startup, not mid-request.
export const emailService: EmailService = buildEmailService();
