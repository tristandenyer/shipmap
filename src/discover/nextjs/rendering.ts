import { readFile } from 'node:fs/promises';
import type { RenderingStrategy } from '../../types.js';

export async function detectRenderingStrategy(filePath: string): Promise<RenderingStrategy> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return 'Unknown';
  }

  // Check for 'use client' directive
  if (/^['"]use client['"];?\s*$/m.test(content)) {
    return 'Client';
  }

  // Check for edge runtime
  if (/export\s+const\s+runtime\s*=\s*['"]edge['"]/m.test(content)) {
    return 'Edge';
  }

  // Check for force-dynamic (SSR)
  if (/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/m.test(content)) {
    return 'SSR';
  }

  // Check for force-static (SSG)
  if (/export\s+const\s+dynamic\s*=\s*['"]force-static['"]/m.test(content)) {
    return 'SSG';
  }

  // Check for ISR (revalidate with a number)
  if (/export\s+const\s+revalidate\s*=\s*\d+/m.test(content)) {
    return 'ISR';
  }

  // Check for generateStaticParams (SSG)
  if (/export\s+(?:async\s+)?function\s+generateStaticParams/m.test(content)) {
    return 'SSG';
  }

  // Pages Router: getServerSideProps → SSR
  if (/export\s+(?:async\s+)?function\s+getServerSideProps/m.test(content)) {
    return 'SSR';
  }

  // Pages Router: getStaticProps → SSG
  if (/export\s+(?:async\s+)?function\s+getStaticProps/m.test(content)) {
    return 'SSG';
  }

  // Server-side dynamic APIs → SSR
  if (/\b(?:cookies|headers)\s*\(\s*\)/.test(content)) {
    return 'SSR';
  }

  // Check for searchParams usage in server components
  if (/searchParams/.test(content) && !/['"]use client['"]/.test(content)) {
    // Only if it's not a client component
    if (/(?:props|{[^}]*searchParams)/.test(content)) {
      return 'SSR';
    }
  }

  // Default: Static (Next.js default for App Router)
  return 'Static';
}

export function detectCacheConfig(content: string): string | undefined {
  // export const revalidate = N
  const revalidateMatch = content.match(/export\s+const\s+revalidate\s*=\s*(\d+)/);
  if (revalidateMatch) {
    return `revalidate:${revalidateMatch[1]}`;
  }

  // fetch(url, { cache: 'no-store' })
  if (/cache:\s*['"]no-store['"]/.test(content)) {
    return 'no-store';
  }

  // fetch(url, { next: { revalidate: N } })
  const fetchRevalidate = content.match(/next:\s*{\s*revalidate:\s*(\d+)\s*}/);
  if (fetchRevalidate) {
    return `revalidate:${fetchRevalidate[1]}`;
  }

  return undefined;
}
