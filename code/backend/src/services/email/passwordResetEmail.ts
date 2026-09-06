import { EmailMessage } from './email.service';

// Kept separate from the EmailService implementations themselves so the
// actual message content isn't duplicated between callers/tests - there is
// exactly one place that decides what a reset email looks like.
export function buildPasswordResetEmail(to: string, resetUrl: string): EmailMessage {
  return {
    to,
    subject: 'Reset your SmartPrint password',
    text: [
      'We received a request to reset your SmartPrint password.',
      '',
      `Reset your password: ${resetUrl}`,
      '',
      'This link expires in 1 hour and can only be used once.',
      "If you didn't request this, you can safely ignore this email.",
    ].join('\n'),
    html:
      `<p>We received a request to reset your SmartPrint password.</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>This link expires in 1 hour and can only be used once.</p>` +
      `<p>If you didn't request this, you can safely ignore this email.</p>`,
  };
}
