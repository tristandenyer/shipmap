import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverMiddleware } from '../src/discover/nextjs/middleware.js';

const fixtures = join(__dirname, 'fixtures');

describe('discoverMiddleware', () => {
  it('discovers middleware in project root', async () => {
    const routeNodeIds = new Map([
      ['/dashboard', 'dash-id'],
      ['/settings', 'settings-id'],
      ['/', 'home-id'],
      ['/about', 'about-id'],
    ]);
    const result = await discoverMiddleware(join(fixtures, 'nextjs-app-router'), routeNodeIds);

    expect(result).not.toBeNull();
    expect(result!.node.type).toBe('middleware');
    expect(result!.node.matcherPatterns).toEqual(['/dashboard/:path*', '/settings/:path*']);
  });

  it('creates connectors for matched routes', async () => {
    const routeNodeIds = new Map([
      ['/dashboard', 'dash-id'],
      ['/dashboard/users', 'dash-users-id'],
      ['/settings', 'settings-id'],
      ['/', 'home-id'],
    ]);
    const result = await discoverMiddleware(join(fixtures, 'nextjs-app-router'), routeNodeIds);

    expect(result).not.toBeNull();
    const targetIds = result!.connectors.map((c) => c.target);
    expect(targetIds).toContain('dash-id');
    expect(targetIds).toContain('dash-users-id');
    expect(targetIds).toContain('settings-id');
    expect(targetIds).not.toContain('home-id');
  });

  it('detects custom auth from content', async () => {
    const result = await discoverMiddleware(join(fixtures, 'nextjs-app-router'), new Map());
    expect(result).not.toBeNull();
    expect(result!.node.authProvider).toBe('Custom');
  });

  it('detects redirect target', async () => {
    const result = await discoverMiddleware(join(fixtures, 'nextjs-app-router'), new Map());
    expect(result).not.toBeNull();
    expect(result!.node.redirectTarget).toBe('/login');
  });

  it('returns null when no middleware exists', async () => {
    const result = await discoverMiddleware(join(fixtures, 'nextjs-pages-router'), new Map());
    expect(result).toBeNull();
  });

  it('discovers middleware in src/', async () => {
    const result = await discoverMiddleware(join(fixtures, 'nextjs-mixed'), new Map());
    expect(result).not.toBeNull();
    expect(result!.node.filePath).toContain('src/middleware.ts');
  });
});
