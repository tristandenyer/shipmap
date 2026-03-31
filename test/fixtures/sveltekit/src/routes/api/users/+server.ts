export async function GET() {
  return new Response(JSON.stringify({ users: [] }));
}

export async function POST({ request }) {
  return new Response(JSON.stringify({ created: true }));
}
