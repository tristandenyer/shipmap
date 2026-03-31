import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { discover } from '../src/discover/index.js';

const fixtures = join(__dirname, 'fixtures');

describe('Vite + React discovery', () => {
  it('detects vite-react framework', async () => {
    const report = await discover(join(fixtures, 'vite-react'));
    expect(report.meta.framework).toBe('vite-react');
  });

  it('discovers routes from createBrowserRouter config', async () => {
    const report = await discover(join(fixtures, 'vite-react'));
    const pages = report.nodes.filter(n => n.type === 'page');
    expect(pages.length).toBeGreaterThanOrEqual(4);

    const paths = pages.map((n: any) => n.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/about');
  });

  it('normalizes dynamic segments :id to [id]', async () => {
    const report = await discover(join(fixtures, 'vite-react'));
    const pages = report.nodes.filter(n => n.type === 'page');
    const paths = pages.map((n: any) => n.path);
    expect(paths).toContain('/users/[id]');
  });

  it('marks all routes as Client rendering', async () => {
    const report = await discover(join(fixtures, 'vite-react'));
    const pages = report.nodes.filter(n => n.type === 'page');
    for (const p of pages) {
      expect((p as any).rendering).toBe('Client');
    }
  });

  it('detects externals from VITE_ prefixed env vars', async () => {
    const report = await discover(join(fixtures, 'vite-react'));
    const externals = report.nodes.filter(n => n.type === 'external');
    const names = externals.map((n: any) => n.name);
    // Stripe and Supabase from .env VITE_ vars
    expect(names).toContain('Stripe');
    expect(names).toContain('Supabase');
  });

  it('returns no middleware', async () => {
    const report = await discover(join(fixtures, 'vite-react'));
    const middleware = report.nodes.filter(n => n.type === 'middleware');
    expect(middleware).toHaveLength(0);
  });
});
