import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(to: string, name: string) {
  return resend.emails.send({
    from: 'noreply@example.com',
    to,
    subject: `Welcome, ${name}!`,
    html: `<h1>Welcome to shipmap demo, ${name}!</h1>`,
  });
}

export async function sendInvoiceEmail(to: string, invoiceId: string) {
  return resend.emails.send({
    from: 'billing@example.com',
    to,
    subject: `Invoice ${invoiceId}`,
    html: `<p>Your invoice ${invoiceId} is ready.</p>`,
  });
}
