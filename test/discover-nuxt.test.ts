import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { nuxtDiscoverer } from '../src/discover/nuxt/discoverer.js';

const fixtureDir = resolve('./test/fixtures/nuxt3');
const discoverer = nuxtDiscoverer;

describe('Nuxt Discoverer', () => {

  describe('discoverRoutes', () => {
    it('should discover page routes from pages directory', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);

      expect(routes).toHaveLength(3);
      expect(routes.map((r) => r.path).sort()).toEqual(['/', '/about', '/users/[id]']);
    });

    it('should detect root route as /', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const rootRoute = routes.find((r) => r.path === '/');

      expect(rootRoute).toBeDefined();
      expect(rootRoute?.filePath).toContain('pages/index.vue');
      expect(rootRoute?.group).toBe('root');
    });

    it('should detect about route', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const aboutRoute = routes.find((r) => r.path === '/about');

      expect(aboutRoute).toBeDefined();
      expect(aboutRoute?.group).toBe('about');
      expect(aboutRoute?.label).toBe('about');
    });

    it('should detect dynamic route with [id] parameter', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const userRoute = routes.find((r) => r.path === '/users/[id]');

      expect(userRoute).toBeDefined();
      expect(userRoute?.group).toBe('users');
    });

    it('should mark route as Client rendering when ssr: false in definePageMeta', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const userRoute = routes.find((r) => r.path === '/users/[id]');

      expect(userRoute?.rendering).toBe('Client');
    });

    it('should default routes to SSR rendering', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const rootRoute = routes.find((r) => r.path === '/');
      const aboutRoute = routes.find((r) => r.path === '/about');

      expect(rootRoute?.rendering).toBe('SSR');
      expect(aboutRoute?.rendering).toBe('SSR');
    });

    it('should assign type "page" to all routes', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);

      for (const route of routes) {
        expect(route.type).toBe('page');
      }
    });

    it('should group routes by first path segment', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);

      const rootRoute = routes.find((r) => r.path === '/');
      const aboutRoute = routes.find((r) => r.path === '/about');
      const userRoute = routes.find((r) => r.path === '/users/[id]');

      expect(rootRoute?.group).toBe('root');
      expect(aboutRoute?.group).toBe('about');
      expect(userRoute?.group).toBe('users');
    });

    it('should assign unique IDs to routes', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const ids = routes.map((r) => r.id);

      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('discoverApiRoutes', () => {
    it('should discover API routes from server/api directory', async () => {
      const routes = await discoverer.discoverApiRoutes(fixtureDir);

      expect(routes.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect /api/users route', async () => {
      const routes = await discoverer.discoverApiRoutes(fixtureDir);
      const usersRoute = routes.find((r) => r.path === '/api/users');

      expect(usersRoute).toBeDefined();
      expect(usersRoute?.filePath).toContain('server/api/users');
      expect(usersRoute?.group).toBe('api');
    });

    it('should detect /api/users/[id] route with GET method', async () => {
      const routes = await discoverer.discoverApiRoutes(fixtureDir);
      const userRoute = routes.find((r) => r.path === '/api/users/[id]');

      expect(userRoute).toBeDefined();
      expect(userRoute?.filePath).toContain('server/api/users/[id].get.ts');
      expect(userRoute?.group).toBe('api');
      expect(userRoute?.methods).toContain('GET');
    });

    it('should extract HTTP method from filename suffix', async () => {
      const routes = await discoverer.discoverApiRoutes(fixtureDir);
      const userRoute = routes.find((r) => r.path === '/api/users/[id]');

      expect(userRoute?.methods).toEqual(['GET']);
    });

    it('should default to GET and POST for routes without method suffix', async () => {
      const routes = await discoverer.discoverApiRoutes(fixtureDir);
      const usersRoute = routes.find((r) => r.path === '/api/users');

      expect(usersRoute?.methods).toContain('GET');
      expect(usersRoute?.methods).toContain('POST');
    });

    it('should assign type "api" to all API routes', async () => {
      const routes = await discoverer.discoverApiRoutes(fixtureDir);

      for (const route of routes) {
        expect(route.type).toBe('api');
      }
    });

    it('should assign unique IDs to API routes', async () => {
      const routes = await discoverer.discoverApiRoutes(fixtureDir);
      const ids = routes.map((r) => r.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should handle dynamic parameters in API routes', async () => {
      const routes = await discoverer.discoverApiRoutes(fixtureDir);
      const userRoute = routes.find((r) => r.path.includes('[id]'));

      expect(userRoute).toBeDefined();
      expect(userRoute?.path).toMatch(/\[id\]/);
    });
  });

  describe('discoverMiddleware', () => {
    it('should discover middleware from server/middleware or middleware directory', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));

      const middleware = await discoverer.discoverMiddleware(fixtureDir, routeNodeIds);

      expect(middleware).not.toBeNull();
    });

    it('should assign middleware type', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));

      const middleware = await discoverer.discoverMiddleware(fixtureDir, routeNodeIds);

      expect(middleware?.node.type).toBe('middleware');
    });

    it('should set matcher patterns to /* for all requests', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));

      const middleware = await discoverer.discoverMiddleware(fixtureDir, routeNodeIds);

      expect(middleware?.node.matcherPatterns).toContain('/*');
    });

    it('should assign runtime as node for Nuxt middleware', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));

      const middleware = await discoverer.discoverMiddleware(fixtureDir, routeNodeIds);

      expect(middleware?.node.runtime).toBe('node');
    });

    it('should detect auth patterns', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));

      const middleware = await discoverer.discoverMiddleware(fixtureDir, routeNodeIds);

      expect(middleware?.node.authProvider).toBe('Custom');
    });

    it('should create middleware-coverage connectors for matched routes', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));

      const middleware = await discoverer.discoverMiddleware(fixtureDir, routeNodeIds);

      expect(middleware?.connectors).toBeDefined();
      expect(middleware?.connectors.length).toBeGreaterThan(0);
    });

    it('should assign unique ID to middleware', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));

      const middleware = await discoverer.discoverMiddleware(fixtureDir, routeNodeIds);

      expect(middleware?.node.id).toBeDefined();
      expect(middleware?.node.id.length).toBeGreaterThan(0);
    });

    it('should return null when no middleware found', async () => {
      const tempFixtureDir = resolve('./test/fixtures/empty');
      const routes = await discoverer.discoverRoutes(tempFixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));

      const middleware = await discoverer.discoverMiddleware(tempFixtureDir, routeNodeIds);

      expect(middleware).toBeNull();
    });
  });

  describe('discoverExternals', () => {
    it('should return externalResult with nodes and connectors', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeFiles = new Map(routes.map((r) => [r.filePath, r.id]));

      const externals = await discoverer.discoverExternals(fixtureDir, routeFiles);

      expect(externals).toBeDefined();
      expect(externals.nodes).toBeDefined();
      expect(Array.isArray(externals.nodes)).toBe(true);
      expect(externals.connectors).toBeDefined();
      expect(Array.isArray(externals.connectors)).toBe(true);
    });

    it('should have matching connectors for external references', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const routeFiles = new Map(routes.map((r) => [r.filePath, r.id]));

      const externals = await discoverer.discoverExternals(fixtureDir, routeFiles);

      if (externals.nodes.length > 0) {
        for (const connector of externals.connectors) {
          expect(connector.type).toBe('external-dependency');
          expect(connector.confidence).toBe('static');
          expect(connector.style).toBe('dashed');
          expect(connector.color).toBe('blue');
        }
      }
    });
  });

  describe('Integration', () => {
    it('should return correct summary counts', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const apiRoutes = await discoverer.discoverApiRoutes(fixtureDir);
      const routeNodeIds = new Map(routes.map((r) => [r.path, r.id]));
      const middleware = await discoverer.discoverMiddleware(fixtureDir, routeNodeIds);

      expect(routes).toHaveLength(3);
      expect(apiRoutes.length).toBeGreaterThanOrEqual(2);
      expect(middleware).not.toBeNull();
    });

    it('should have consistent IDs across discovery methods', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const apiRoutes = await discoverer.discoverApiRoutes(fixtureDir);
      const allNodeIds = [...routes, ...apiRoutes].map((r) => r.id);

      expect(new Set(allNodeIds).size).toBe(allNodeIds.length);
    });

    it('should discover multiple page groups', async () => {
      const routes = await discoverer.discoverRoutes(fixtureDir);
      const groups = new Set(routes.map((r) => r.group));

      expect(groups.has('root')).toBe(true);
      expect(groups.has('about')).toBe(true);
      expect(groups.has('users')).toBe(true);
    });
  });
});
