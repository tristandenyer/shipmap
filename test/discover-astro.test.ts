import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { discoverRoutes } from '../src/discover/astro/routes.js';
import { discoverApiRoutes } from '../src/discover/astro/api.js';
import { discoverMiddleware } from '../src/discover/astro/middleware.js';

const fixtures = join(__dirname, 'fixtures', 'astro');

describe('Astro discoverer', () => {
  describe('discoverRoutes', () => {
    it('discovers .astro pages in src/pages', async () => {
      const routes = await discoverRoutes(fixtures);
      expect(routes.length).toBe(3);

      const paths = routes.map(r => r.path).sort();
      expect(paths).toEqual(['/', '/about', '/blog/[slug]']);
    });

    it('detects SSG for static pages', async () => {
      const routes = await discoverRoutes(fixtures);
      const home = routes.find(r => r.path === '/');
      const about = routes.find(r => r.path === '/about');

      expect(home?.rendering).toBe('SSG');
      expect(about?.rendering).toBe('SSG');
    });

    it('detects SSR when prerender = false in hybrid mode', async () => {
      const routes = await discoverRoutes(fixtures);
      const blog = routes.find(r => r.path === '/blog/[slug]');

      expect(blog?.rendering).toBe('SSR');
    });

    it('groups routes by first path segment', async () => {
      const routes = await discoverRoutes(fixtures);

      const rootRoutes = routes.filter(r => r.group === 'root');
      const blogRoutes = routes.filter(r => r.group === 'blog');

      expect(rootRoutes.length).toBe(2); // / and /about
      expect(blogRoutes.length).toBe(1); // /blog/[slug]
    });

    it('sets correct filePaths relative to project', async () => {
      const routes = await discoverRoutes(fixtures);
      const home = routes.find(r => r.path === '/');

      expect(home?.filePath).toBe('src/pages/index.astro');
    });

    it('returns empty array when src/pages does not exist', async () => {
      const routes = await discoverRoutes('/tmp/nonexistent');
      expect(routes).toEqual([]);
    });
  });

  describe('discoverApiRoutes', () => {
    it('discovers .ts and .js files in src/pages', async () => {
      const routes = await discoverApiRoutes(fixtures);
      expect(routes.length).toBe(1);
      expect(routes[0].path).toBe('/api/users');
    });

    it('detects HTTP methods from exports', async () => {
      const routes = await discoverApiRoutes(fixtures);
      const users = routes.find(r => r.path === '/api/users');

      expect(users?.methods).toContain('GET');
      expect(users?.methods).toContain('POST');
      expect(users?.methods?.length).toBe(2);
    });

    it('sets type to api', async () => {
      const routes = await discoverApiRoutes(fixtures);
      expect(routes.every(r => r.type === 'api')).toBe(true);
    });

    it('groups api routes by first path segment', async () => {
      const routes = await discoverApiRoutes(fixtures);
      expect(routes[0].group).toBe('api');
    });

    it('returns empty array when src/pages does not exist', async () => {
      const routes = await discoverApiRoutes('/tmp/nonexistent');
      expect(routes).toEqual([]);
    });
  });

  describe('discoverMiddleware', () => {
    it('discovers middleware from src/middleware.ts', async () => {
      const routeNodeIds = new Map([
        ['/', 'home-id'],
        ['/about', 'about-id'],
        ['/api/users', 'users-id'],
      ]);

      const result = await discoverMiddleware(fixtures, routeNodeIds);

      expect(result).not.toBeNull();
      expect(result!.node.type).toBe('middleware');
      expect(result!.node.filePath).toContain('src/middleware.ts');
    });

    it('detects onRequest export', async () => {
      const result = await discoverMiddleware(fixtures, new Map());

      expect(result).not.toBeNull();
      expect(result!.node.label).toBe('Middleware');
    });

    it('sets matcher patterns to /*', async () => {
      const result = await discoverMiddleware(fixtures, new Map());

      expect(result).not.toBeNull();
      expect(result!.node.matcherPatterns).toEqual(['/*']);
    });

    it('detects auth patterns from content', async () => {
      const result = await discoverMiddleware(fixtures, new Map());

      expect(result).not.toBeNull();
      expect(result!.node.authProvider).toBe('Custom');
    });

    it('detects redirect target from content', async () => {
      const result = await discoverMiddleware(fixtures, new Map());

      expect(result).not.toBeNull();
      expect(result!.node.redirectTarget).toBe('/login');
    });

    it('creates connectors to all routes', async () => {
      const routeNodeIds = new Map([
        ['/', 'home-id'],
        ['/about', 'about-id'],
        ['/api/users', 'users-id'],
      ]);

      const result = await discoverMiddleware(fixtures, routeNodeIds);

      expect(result).not.toBeNull();
      expect(result!.connectors.length).toBe(3);

      const targetIds = result!.connectors.map(c => c.target);
      expect(targetIds).toContain('home-id');
      expect(targetIds).toContain('about-id');
      expect(targetIds).toContain('users-id');
    });

    it('returns null when no middleware exists', async () => {
      const result = await discoverMiddleware('/tmp/nonexistent', new Map());
      expect(result).toBeNull();
    });

    it('sets runtime to node', async () => {
      const result = await discoverMiddleware(fixtures, new Map());

      expect(result).not.toBeNull();
      expect(result!.node.runtime).toBe('node');
    });
  });
});
