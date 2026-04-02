import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverPageRoutes } from '../src/discover/nextjs/routes.js';

const fixtures = join(__dirname, 'fixtures');

describe('discoverPageRoutes', () => {
  it('discovers App Router pages', async () => {
    const routes = await discoverPageRoutes(join(fixtures, 'nextjs-app-router'));
    const paths = routes.map((r) => r.path).sort();
    expect(paths).toContain('/');
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/settings');
    expect(paths).toContain('/about'); // route group stripped
  });

  it('detects rendering strategies', async () => {
    const routes = await discoverPageRoutes(join(fixtures, 'nextjs-app-router'));
    const dashboard = routes.find((r) => r.path === '/dashboard');
    expect(dashboard?.rendering).toBe('Client');

    const settings = routes.find((r) => r.path === '/settings');
    expect(settings?.rendering).toBe('SSR');

    const about = routes.find((r) => r.path === '/about');
    expect(about?.rendering).toBe('ISR');

    const home = routes.find((r) => r.path === '/');
    expect(home?.rendering).toBe('Static');
  });

  it('discovers Pages Router pages', async () => {
    const routes = await discoverPageRoutes(join(fixtures, 'nextjs-pages-router'));
    const paths = routes.map((r) => r.path).sort();
    expect(paths).toContain('/');
    expect(paths).toContain('/dashboard');
  });

  it('detects Pages Router rendering strategies', async () => {
    const routes = await discoverPageRoutes(join(fixtures, 'nextjs-pages-router'));
    const home = routes.find((r) => r.path === '/');
    expect(home?.rendering).toBe('SSG');

    const dashboard = routes.find((r) => r.path === '/dashboard');
    expect(dashboard?.rendering).toBe('SSR');
  });

  it('discovers src/app routes', async () => {
    const routes = await discoverPageRoutes(join(fixtures, 'nextjs-mixed'));
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('/');
  });

  it('assigns correct groups', async () => {
    const routes = await discoverPageRoutes(join(fixtures, 'nextjs-app-router'));
    const home = routes.find((r) => r.path === '/');
    expect(home?.group).toBe('root');

    const dashboard = routes.find((r) => r.path === '/dashboard');
    expect(dashboard?.group).toBe('root');
  });

  it('assigns UUIDs to all routes', async () => {
    const routes = await discoverPageRoutes(join(fixtures, 'nextjs-app-router'));
    for (const route of routes) {
      expect(route.id).toBeTruthy();
      expect(route.id.length).toBe(36); // UUID format
    }
  });
});
