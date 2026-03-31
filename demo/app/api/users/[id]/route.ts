import { prisma } from '../../../lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(user);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const user = await prisma.user.update({ where: { id: params.id }, data: body });
  return Response.json(user);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await prisma.user.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
}
