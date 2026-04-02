import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectRenderingStrategy } from '../src/discover/nextjs/rendering.js';

const fixtures = join(__dirname, 'fixtures');

describe('detectRenderingStrategy', () => {
  it('detects Static (default)', async () => {
    const result = await detectRenderingStrategy(join(fixtures, 'nextjs-app-router/app/page.tsx'));
    expect(result).toBe('Static');
  });

  it('detects Client component', async () => {
    const result = await detectRenderingStrategy(join(fixtures, 'nextjs-app-router/app/dashboard/page.tsx'));
    expect(result).toBe('Client');
  });

  it('detects SSR from cookies() usage', async () => {
    const result = await detectRenderingStrategy(join(fixtures, 'nextjs-app-router/app/settings/page.tsx'));
    expect(result).toBe('SSR');
  });

  it('detects ISR from revalidate', async () => {
    const result = await detectRenderingStrategy(join(fixtures, 'nextjs-app-router/app/(marketing)/about/page.tsx'));
    expect(result).toBe('ISR');
  });

  it('detects SSG from getStaticProps', async () => {
    const result = await detectRenderingStrategy(join(fixtures, 'nextjs-pages-router/pages/index.tsx'));
    expect(result).toBe('SSG');
  });

  it('detects SSR from getServerSideProps', async () => {
    const result = await detectRenderingStrategy(join(fixtures, 'nextjs-pages-router/pages/dashboard/index.tsx'));
    expect(result).toBe('SSR');
  });

  it('returns Unknown for missing file', async () => {
    const result = await detectRenderingStrategy('/tmp/nonexistent.tsx');
    expect(result).toBe('Unknown');
  });
});
