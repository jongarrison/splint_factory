import { Resend } from 'resend';
import { type ReactElement } from 'react';
import { render } from '@react-email/components';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Splint Factory <noreply@notifications.splintfactory.com>';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  react?: ReactElement;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, react, replyTo }: SendEmailParams) {
  const resend = getResend();

  // Pre-render React components to HTML
  const htmlContent = react ? await render(react) : html!;

  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set, skipping email send');
    // In dev, extract and log any URLs from the HTML so devs can use them
    const urlMatches = htmlContent.match(/https?:\/\/[^"<\s]+/g);
    if (urlMatches) {
      console.log('[Email] Links from email:');
      urlMatches.forEach(url => console.log(`  ${url}`));
    }
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: Array.isArray(to) ? to : [to],
    subject,
    html: htmlContent,
    replyTo,
  });

  if (error) {
    console.error('[Email] Failed to send:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}
