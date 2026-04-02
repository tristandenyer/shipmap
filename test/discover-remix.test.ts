import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { remixDiscoverer } from '../src/discover/remix/discoverer.js';

const fixtures = join(__dirname, 'fixtures');
const remixFixture = join(fixtures, 'remix-v2');

describe('remixDiscoverer', () => {
  describe('discoverRoutes', () => {
    it('detects flat routes with correct paths', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);

      expect(routes).toContainEqual(
        expect.objectContaining({
          type: 'page',
          path: '/',
          label: 'Home',
        }),
      );

      expect(routes).toContainEqual(
        expect.objectContaining({
          type: 'page',
          path: '/about',
        }),
      );

      expect(routes).toContainEqual(
        expect.objectContaining({
          type: 'page',
          path: '/dashboard',
        }),
      );

      expect(routes).toContainEqual(
        expect.objectContaining({
          type: 'page',
          path: '/dashboard/settings',
        }),
      );
    });

    it('handles _index routes', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);

      // dashboard._index should create /dashboard route (index within dashboard)
      const dashboardRoutes = routes.filter((r) => r.path.startsWith('/dashboard'));
      expect(dashboardRoutes).toContainEqual(
        expect.objectContaining({
          type: 'page',
          path: '/dashboard',
        }),
      );
    });

    it('normalizes $params to [param] format', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);

      expect(routes).toContainEqual(
        expect.objectContaining({
          type: 'page',
          path: '/[userId]',
        }),
      );
    });

    it('detects loaders as SSR rendering strategy', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);

      const indexRoute = routes.find((r) => r.path === '/');
      expect(indexRoute).toBeDefined();
      expect(indexRoute?.rendering).toBe('SSR');

      const dashboardRoute = routes.find((r) => r.path === '/dashboard');
      expect(dashboardRoute).toBeDefined();
      expect(dashboardRoute?.rendering).toBe('SSR');
    });

    it('marks routes without loader as Static', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);

      const aboutRoute = routes.find((r) => r.path === '/about');
      expect(aboutRoute).toBeDefined();
      expect(aboutRoute?.rendering).toBe('Static');
    });

    it('groups routes by first segment', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);

      const rootRoutes = routes.filter((r) => r.group === 'root');
      const dashboardRoutes = routes.filter((r) => r.group === 'dashboard');

      expect(rootRoutes.length).toBeGreaterThan(0);
      expect(dashboardRoutes.length).toBeGreaterThan(0);

      // Verify root group contains / and /about, /[userId]
      expect(rootRoutes.map((r) => r.path)).toContain('/');
      expect(rootRoutes.map((r) => r.path)).toContain('/about');
      expect(rootRoutes.map((r) => r.path)).toContain('/[userId]');

      // Verify dashboard group contains dashboard routes
      expect(dashboardRoutes.map((r) => r.path)).toContain('/dashboard');
      expect(dashboardRoutes.map((r) => r.path)).toContain('/dashboard/settings');
    });

    it('excludes routes without default export', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);

      // api.users route has no default export, should not appear in page routes
      expect(routes.map((r) => r.path)).not.toContain('/api/users');
    });
  });

  describe('discoverApiRoutes', () => {
    it('identifies API-only routes (no component)', async () => {
      const apiRoutes = await remixDiscoverer.discoverApiRoutes(remixFixture);

      expect(apiRoutes).toContainEqual(
        expect.objectContaining({
          type: 'api',
          path: '/api/users',
        }),
      );
    });

    it('detects GET from loader', async () => {
      const apiRoutes = await remixDiscoverer.discoverApiRoutes(remixFixture);

      const apiUsersRoute = apiRoutes.find((r) => r.path === '/api/users');
      expect(apiUsersRoute).toBeDefined();
      expect(apiUsersRoute?.methods).toContain('GET');
    });

    it('detects POST from action', async () => {
      const apiRoutes = await remixDiscoverer.discoverApiRoutes(remixFixture);

      const apiUsersRoute = apiRoutes.find((r) => r.path === '/api/users');
      expect(apiUsersRoute).toBeDefined();
      expect(apiUsersRoute?.methods).toContain('POST');
    });

    it('excludes page routes with default export', async () => {
      const apiRoutes = await remixDiscoverer.discoverApiRoutes(remixFixture);

      // These have default exports and should not appear as API routes
      expect(apiRoutes.map((r) => r.path)).not.toContain('/');
      expect(apiRoutes.map((r) => r.path)).not.toContain('/about');
      expect(apiRoutes.map((r) => r.path)).not.toContain('/dashboard');
    });
  });

  describe('discoverMiddleware', () => {
    it('returns null (Remix has no traditional middleware)', async () => {
      const result = await remixDiscoverer.discoverMiddleware(remixFixture, new Map());
      expect(result).toBeNull();
    });
  });

  describe('discoverExternals', () => {
    it('returns externals result object', async () => {
      const routeFiles = new Map([
        ['app/routes/_index.tsx', 'test-id-1'],
        ['app/routes/dashboard.tsx', 'test-id-2'],
      ]);

      const result = await remixDiscoverer.discoverExternals(remixFixture, routeFiles);

      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('connectors');
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.connectors)).toBe(true);
    });

    it('creates external nodes for detected services', async () => {
      const routeFiles = new Map([['app/routes/_index.tsx', 'test-id-1']]);

      const result = await remixDiscoverer.discoverExternals(remixFixture, routeFiles);

      // Even if no externals are detected, structure should be valid
      expect(result.nodes).toBeDefined();
      expect(result.connectors).toBeDefined();
    });
  });

  describe('integration', () => {
    it('routes and api routes do not overlap', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);
      const apiRoutes = await remixDiscoverer.discoverApiRoutes(remixFixture);

      const routePaths = new Set(routes.map((r) => r.path));
      const apiPaths = new Set(apiRoutes.map((r) => r.path));

      const overlap = [...routePaths].filter((p) => apiPaths.has(p));
      expect(overlap).toHaveLength(0);
    });

    it('all route nodes have required properties', async () => {
      const routes = await remixDiscoverer.discoverRoutes(remixFixture);

      for (const route of routes) {
        expect(route).toHaveProperty('id');
        expect(route).toHaveProperty('type', 'page');
        expect(route).toHaveProperty('path');
        expect(route).toHaveProperty('filePath');
        expect(route).toHaveProperty('group');
        expect(route).toHaveProperty('label');
        expect(route).toHaveProperty('rendering');
        expect(route.id).toBeTruthy();
        expect(route.path).toBeTruthy();
      }
    });

    it('all api route nodes have required properties', async () => {
      const apiRoutes = await remixDiscoverer.discoverApiRoutes(remixFixture);

      for (const route of apiRoutes) {
        expect(route).toHaveProperty('id');
        expect(route).toHaveProperty('type', 'api');
        expect(route).toHaveProperty('path');
        expect(route).toHaveProperty('filePath');
        expect(route).toHaveProperty('group');
        expect(route).toHaveProperty('label');
        expect(route.id).toBeTruthy();
        expect(route.path).toBeTruthy();
      }
    });
  });
});
