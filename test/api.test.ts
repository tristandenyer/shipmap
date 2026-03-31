import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { discoverApiRoutes } from '../src/discover/nextjs/api.js';

const fixtures = join(__dirname, 'fixtures');

describe('discoverApiRoutes', () => {
  it('discovers App Router API routes', async () => {
    const routes = await discoverApiRoutes(join(fixtures, 'nextjs-app-router'));
    const paths = routes.map(r => r.path).sort();
    expect(paths).toContain('/api/auth');
    expect(paths).toContain('/api/users');
  });

  it('detects HTTP methods from exports', async () => {
    const routes = await discoverApiRoutes(join(fixtures, 'nextjs-app-router'));
    const users = routes.find(r => r.path === '/api/users');
    expect(users?.methods).toContain('GET');
    expect(users?.methods).toContain('POST');

    const auth = routes.find(r => r.path === '/api/auth');
    expect(auth?.methods).toContain('POST');
    expect(auth?.methods).not.toContain('GET');
  });

  it('discovers Pages Router API routes', async () => {
    const routes = await discoverApiRoutes(join(fixtures, 'nextjs-pages-router'));
    const paths = routes.map(r => r.path);
    expect(paths).toContain('/api/hello');
  });

  it('detects Pages Router methods from req.method checks', async () => {
    const routes = await discoverApiRoutes(join(fixtures, 'nextjs-pages-router'));
    const hello = routes.find(r => r.path === '/api/hello');
    expect(hello?.methods).toContain('GET');
    expect(hello?.methods).toContain('POST');
  });

  it('discovers src/app API routes', async () => {
    const routes = await discoverApiRoutes(join(fixtures, 'nextjs-mixed'));
    const paths = routes.map(r => r.path);
    expect(paths).toContain('/api/health');
  });

  it('all API routes have type api', async () => {
    const routes = await discoverApiRoutes(join(fixtures, 'nextjs-app-router'));
    for (const route of routes) {
      expect(route.type).toBe('api');
    }
  });
});
