import { prisma } from '../../lib/db';

export async function GET() {
  const users = await prisma.user.findMany();
  return Response.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await prisma.user.create({ data: body });
  return Response.json(user, { status: 201 });
}
