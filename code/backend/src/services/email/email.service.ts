// Vendor-agnostic email abstraction so auth.service.ts (and any future
// caller) never talks to a specific mail provider directly - only to this
// interface. Swapping SMTP for Resend/SendGrid/SES later means adding a new
// implementation here, not touching any calling code.
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}
