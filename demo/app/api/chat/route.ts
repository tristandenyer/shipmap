import OpenAI from 'openai';

export const runtime = 'edge';

const openai = new OpenAI();

export async function POST(request: Request) {
  const { messages } = await request.json();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
  });

  return new Response(completion.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
