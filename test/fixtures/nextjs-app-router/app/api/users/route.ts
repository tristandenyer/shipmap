// biome-ignore lint/correctness/noUnusedImports: fixture import scanned by externals discoverer
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ user: body });
}
