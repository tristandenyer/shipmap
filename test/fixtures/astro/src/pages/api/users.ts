export async function GET() {
  return new Response(JSON.stringify({ users: [] }));
}

export async function POST({ request }) {
  const _body = await request.json();
  return new Response(JSON.stringify({ created: true }));
}
