import { EmailMessage, EmailService } from './email.service';

// Development-only fallback used when no SMTP transport is configured (see
// services/email/index.ts). It does NOT pretend an email was sent - it logs
// that no real transport is configured and prints the message body (which,
// for a password reset, is the only place the developer can otherwise get
// the reset URL) so the flow stays testable end-to-end without a real inbox.
// This service must never be selected in production - see index.ts.
export class DevConsoleEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      [
        '[dev email - no SMTP transport configured, nothing was actually sent]',
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        message.text,
      ].join('\n'),
    );
  }
}
