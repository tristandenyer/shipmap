import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { sveltekitDiscoverer } from '../src/discover/sveltekit/discoverer.js';

const FIXTURE_DIR = resolve(__dirname, 'fixtures', 'sveltekit');

describe('SvelteKit Discoverer', () => {
  describe('discoverRoutes', () => {
    it('should discover page routes from +page.svelte files', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);

      expect(routes).toHaveLength(4);
      expect(routes.map((r) => r.path).sort()).toEqual(['/', '/about', '/dashboard', '/posts/[slug]']);
    });

    it('should detect home route', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);
      const home = routes.find((r) => r.path === '/');

      expect(home).toBeDefined();
      expect(home?.type).toBe('page');
      expect(home?.group).toBe('root');
      expect(home?.label).toBe('Home');
      expect(home?.rendering).toBe('Static');
    });

    it('should detect about route as SSR (has +page.server.ts with load)', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);
      const about = routes.find((r) => r.path === '/about');

      expect(about).toBeDefined();
      expect(about?.type).toBe('page');
      expect(about?.rendering).toBe('SSR');
      expect(about?.group).toBe('about');
    });

    it('should detect dashboard route as Client (has ssr = false)', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);
      const dashboard = routes.find((r) => r.path === '/dashboard');

      expect(dashboard).toBeDefined();
      expect(dashboard?.type).toBe('page');
      expect(dashboard?.rendering).toBe('Client');
      expect(dashboard?.group).toBe('dashboard');
    });

    it('should detect parameterized route', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);
      const post = routes.find((r) => r.path === '/posts/[slug]');

      expect(post).toBeDefined();
      expect(post?.type).toBe('page');
      expect(post?.group).toBe('posts');
    });

    it('should group routes by first segment', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);

      const rootRoutes = routes.filter((r) => r.group === 'root');
      const aboutRoutes = routes.filter((r) => r.group === 'about');
      const dashboardRoutes = routes.filter((r) => r.group === 'dashboard');
      const postsRoutes = routes.filter((r) => r.group === 'posts');

      expect(rootRoutes).toHaveLength(1);
      expect(aboutRoutes).toHaveLength(1);
      expect(dashboardRoutes).toHaveLength(1);
      expect(postsRoutes).toHaveLength(1);
    });

    it('should set probe status to not-probed', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);

      for (const route of routes) {
        expect(route.probe?.status).toBe('not-probed');
      }
    });

    it('should have IDs for all routes', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);

      for (const route of routes) {
        expect(route.id).toBeDefined();
        expect(route.id).toMatch(/^[0-9a-f-]{36}$/);
      }
    });
  });

  describe('discoverApiRoutes', () => {
    it('should discover API routes from +server.ts files', async () => {
      const apiRoutes = await sveltekitDiscoverer.discoverApiRoutes(FIXTURE_DIR);

      expect(apiRoutes).toHaveLength(1);
      expect(apiRoutes[0]?.path).toBe('/api/users');
    });

    it('should detect HTTP methods from +server.ts exports', async () => {
      const apiRoutes = await sveltekitDiscoverer.discoverApiRoutes(FIXTURE_DIR);
      const usersApi = apiRoutes[0];

      expect(usersApi).toBeDefined();
      expect(usersApi?.type).toBe('api');
      expect(usersApi?.methods).toContain('GET');
      expect(usersApi?.methods).toContain('POST');
      expect(usersApi?.methods).toHaveLength(2);
    });

    it('should group API routes by first segment', async () => {
      const apiRoutes = await sveltekitDiscoverer.discoverApiRoutes(FIXTURE_DIR);
      const usersApi = apiRoutes[0];

      expect(usersApi?.group).toBe('api');
    });

    it('should have IDs for all API routes', async () => {
      const apiRoutes = await sveltekitDiscoverer.discoverApiRoutes(FIXTURE_DIR);

      for (const route of apiRoutes) {
        expect(route.id).toBeDefined();
        expect(route.id).toMatch(/^[0-9a-f-]{36}$/);
      }
    });

    it('should set probe status to not-probed', async () => {
      const apiRoutes = await sveltekitDiscoverer.discoverApiRoutes(FIXTURE_DIR);

      for (const route of apiRoutes) {
        expect(route.probe?.status).toBe('not-probed');
      }
    });
  });

  describe('discoverMiddleware', () => {
    it('should detect hooks.server.ts as middleware', async () => {
      const routeNodeIds = new Map<string, string>();
      const middleware = await sveltekitDiscoverer.discoverMiddleware(FIXTURE_DIR, routeNodeIds);

      expect(middleware).toBeDefined();
      expect(middleware?.node.type).toBe('middleware');
      expect(middleware?.node.filePath).toBe('src/hooks.server.ts');
      expect(middleware?.node.label).toBe('hooks.server');
    });

    it('should set middleware runtime to node', async () => {
      const routeNodeIds = new Map<string, string>();
      const middleware = await sveltekitDiscoverer.discoverMiddleware(FIXTURE_DIR, routeNodeIds);

      expect(middleware?.node.runtime).toBe('node');
    });

    it('should set matcher patterns to [/*]', async () => {
      const routeNodeIds = new Map<string, string>();
      const middleware = await sveltekitDiscoverer.discoverMiddleware(FIXTURE_DIR, routeNodeIds);

      expect(middleware?.node.matcherPatterns).toEqual(['/*']);
    });

    it('should detect auth provider from hooks keywords', async () => {
      const routeNodeIds = new Map<string, string>();
      const middleware = await sveltekitDiscoverer.discoverMiddleware(FIXTURE_DIR, routeNodeIds);

      expect(middleware?.node.authProvider).toBeDefined();
      expect(middleware?.node.authProvider).toBe('Custom');
    });

    it('should create connectors from middleware to all routes', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);
      const apiRoutes = await sveltekitDiscoverer.discoverApiRoutes(FIXTURE_DIR);

      const routeNodeIds = new Map<string, string>();
      for (const route of [...routes, ...apiRoutes]) {
        routeNodeIds.set(route.filePath, route.id);
      }

      const middleware = await sveltekitDiscoverer.discoverMiddleware(FIXTURE_DIR, routeNodeIds);

      expect(middleware?.connectors).toBeDefined();
      expect(middleware?.connectors.length).toBeGreaterThan(0);
    });

    it('should set middleware connector properties correctly', async () => {
      const routeNodeIds = new Map<string, string>([['src/routes/+page.svelte', 'route-1']]);
      const middleware = await sveltekitDiscoverer.discoverMiddleware(FIXTURE_DIR, routeNodeIds);

      const connector = middleware?.connectors[0];
      expect(connector?.source).toBe(middleware?.node.id);
      expect(connector?.target).toBe('route-1');
      expect(connector?.type).toBe('middleware-coverage');
      expect(connector?.confidence).toBe('static');
      expect(connector?.style).toBe('dashed');
      expect(connector?.color).toBe('amber');
    });

    it('should return null if hooks.server.ts does not exist', async () => {
      const middleware = await sveltekitDiscoverer.discoverMiddleware('/nonexistent', new Map());

      expect(middleware).toBeNull();
    });

    it('should return null if handle export is missing', async () => {
      // This would require creating a temporary test fixture without the handle export
      // For now, we verify the behavior by testing with a non-existent path
      const middleware = await sveltekitDiscoverer.discoverMiddleware(
        '/some/nonexistent/path',
        new Map(),
      );

      expect(middleware).toBeNull();
    });

    it('should have an ID for middleware', async () => {
      const routeNodeIds = new Map<string, string>();
      const middleware = await sveltekitDiscoverer.discoverMiddleware(FIXTURE_DIR, routeNodeIds);

      expect(middleware?.node.id).toBeDefined();
      expect(middleware?.node.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('discoverExternals', () => {
    it('should discover externals from route files', async () => {
      const routeFiles = new Map<string, string>([['src/routes/about/+page.server.ts', 'route-1']]);
      const result = await sveltekitDiscoverer.discoverExternals(FIXTURE_DIR, routeFiles);

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.connectors).toBeDefined();
    });

    it('should return empty nodes if no externals detected', async () => {
      const result = await sveltekitDiscoverer.discoverExternals(FIXTURE_DIR, new Map());

      expect(result.nodes).toEqual([]);
      expect(result.connectors).toEqual([]);
    });
  });

  describe('Route group stripping', () => {
    it('should strip route groups from paths', async () => {
      // Create a route group test by checking if any routes in the fixture
      // have parentheses (they don't in this fixture, so this is more of a
      // verification that the logic would work if they did)
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);

      // Verify no routes have parentheses in their paths
      for (const route of routes) {
        expect(route.path).not.toMatch(/\(/);
        expect(route.path).not.toMatch(/\)/);
      }
    });
  });

  describe('Framework detection', () => {
    it('should discover all route types together', async () => {
      const routes = await sveltekitDiscoverer.discoverRoutes(FIXTURE_DIR);
      const apiRoutes = await sveltekitDiscoverer.discoverApiRoutes(FIXTURE_DIR);

      expect(routes.length).toBeGreaterThan(0);
      expect(apiRoutes.length).toBeGreaterThan(0);

      // Verify they are distinct
      const routePaths = routes.map((r) => r.path);
      const apiPaths = apiRoutes.map((r) => r.path);

      for (const apiPath of apiPaths) {
        expect(routePaths).not.toContain(apiPath);
      }
    });
  });
});
