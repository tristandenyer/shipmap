import { describe, expect, it } from 'vitest';
import { generateMarkdown } from '../src/diff/markdown.js';
import type { ExternalNode, MiddlewareNode, RouteNode, TopologyReport } from '../src/types.js';

function makeReport(overrides: Partial<TopologyReport> = {}): TopologyReport {
  return {
    meta: {
      tool: 'shipmap',
      version: '0.3.0',
      generatedAt: '2025-01-01T00:00:00.000Z',
      framework: 'nextjs',
      projectName: 'test-project',
      mode: 'static',
    },
    nodes: [],
    connectors: [],
    groups: {},
    summary: {
      totalRoutes: 0,
      totalApiRoutes: 0,
      totalMiddleware: 0,
      totalExternals: 0,
      protectedRoutes: 0,
      renderingBreakdown: {},
    },
    ...overrides,
  };
}

describe('generateMarkdown', () => {
  it('produces header with project name', () => {
    const md = generateMarkdown(makeReport());
    expect(md).toContain('# shipmap — test-project');
  });

  it('includes framework and mode in header', () => {
    const md = generateMarkdown(makeReport());
    expect(md).toContain('Framework: nextjs');
    expect(md).toContain('Mode: Static');
  });

  it('lists pages in static mode', () => {
    const page: RouteNode = {
      id: 'p1',
      type: 'page',
      path: '/home',
      filePath: 'app/page.tsx',
      group: '/',
      label: '/home',
      rendering: 'SSR',
    };
    const md = generateMarkdown(makeReport({ nodes: [page] }));

    expect(md).toContain('## Pages (1)');
    expect(md).toContain('| Route | Rendering | Auth |');
    expect(md).toContain('`/home`');
    expect(md).toContain('SSR');
    expect(md).toContain('Public');
  });

  it('lists pages in probe mode with status columns', () => {
    const page: RouteNode = {
      id: 'p1',
      type: 'page',
      path: '/home',
      filePath: 'app/page.tsx',
      group: '/',
      label: '/home',
      rendering: 'SSR',
      probe: { status: 'ok', httpStatus: 200, responseTime: 50 },
    };
    const report = makeReport({ nodes: [page] });
    report.meta.mode = 'probe';
    const md = generateMarkdown(report);

    expect(md).toContain('| Route | Rendering | Status | Response Time | Auth |');
    expect(md).toContain('200');
    expect(md).toContain('50ms');
  });

  it('lists API routes with methods', () => {
    const api: RouteNode = {
      id: 'a1',
      type: 'api',
      path: '/api/users',
      filePath: 'app/api/users/route.ts',
      group: '/api',
      label: '/api/users',
      methods: ['GET', 'POST'],
    };
    const md = generateMarkdown(makeReport({ nodes: [api] }));

    expect(md).toContain('## API Routes (1)');
    expect(md).toContain('GET, POST');
  });

  it('lists middleware', () => {
    const mw: MiddlewareNode = {
      id: 'mw1',
      type: 'middleware',
      filePath: 'middleware.ts',
      label: 'middleware',
      group: 'middleware',
      matcherPatterns: ['/dashboard/:path*'],
      authProvider: 'NextAuth',
      runtime: 'edge',
    };
    const md = generateMarkdown(makeReport({ nodes: [mw] }));

    expect(md).toContain('## Middleware (1)');
    expect(md).toContain('NextAuth');
    expect(md).toContain('/dashboard/:path*');
    expect(md).toContain('edge');
  });

  it('lists external services', () => {
    const ext: ExternalNode = {
      id: 'ext1',
      type: 'external',
      name: 'Stripe',
      label: 'Stripe',
      group: 'external',
      host: 'api.stripe.com',
      detectedFrom: 'env',
      referencedBy: ['/api/pay', '/api/webhook'],
    };
    const md = generateMarkdown(makeReport({ nodes: [ext] }));

    expect(md).toContain('## External Services (1)');
    expect(md).toContain('Stripe');
    expect(md).toContain('2 routes');
  });

  it('includes summary section', () => {
    const page: RouteNode = {
      id: 'p1',
      type: 'page',
      path: '/home',
      filePath: 'app/page.tsx',
      group: '/',
      label: '/home',
      rendering: 'SSR',
    };
    const md = generateMarkdown(makeReport({ nodes: [page] }));

    expect(md).toContain('## Summary');
    expect(md).toContain('1 pages');
  });

  it('shows protected routes count in summary', () => {
    const md = generateMarkdown(
      makeReport({
        summary: {
          totalRoutes: 1,
          totalApiRoutes: 0,
          totalMiddleware: 1,
          totalExternals: 0,
          protectedRoutes: 3,
          renderingBreakdown: {},
        },
      }),
    );

    expect(md).toContain('3 protected routes');
  });

  it('shows probe summary in probe mode', () => {
    const pages: RouteNode[] = [
      {
        id: 'p1',
        type: 'page',
        path: '/ok',
        filePath: 'a.tsx',
        group: '/',
        label: '/ok',
        probe: { status: 'ok', httpStatus: 200, responseTime: 50 },
      },
      {
        id: 'p2',
        type: 'page',
        path: '/err',
        filePath: 'b.tsx',
        group: '/',
        label: '/err',
        probe: { status: 'error', httpStatus: 500, responseTime: 100 },
      },
    ];
    const report = makeReport({ nodes: pages });
    report.meta.mode = 'probe';
    const md = generateMarkdown(report);

    expect(md).toContain('1 OK');
    expect(md).toContain('1 errors');
  });
});
