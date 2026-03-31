import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  const users = await prisma.user.findMany();
  return Response.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await prisma.user.create({ data: body });

  // Send welcome email
  await resend.emails.send({
    from: 'noreply@example.com',
    to: body.email,
    subject: 'Welcome!',
    html: '<h1>Welcome</h1>',
  });

  return Response.json(user, { status: 201 });
}
