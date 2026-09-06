import nodemailer, { Transporter } from 'nodemailer';

import { EmailMessage, EmailService } from './email.service';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

// Thin wrapper around nodemailer - the one place a concrete mail vendor
// (SMTP here; swap the transporter for Resend/SendGrid/SES later) is
// referenced. Never logs message bodies (which may contain a raw reset
// token) - only enough to confirm a send attempt happened.
export class SmtpEmailService implements EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
    this.from = config.from;
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
