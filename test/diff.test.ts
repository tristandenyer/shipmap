import { describe, it, expect } from 'vitest';
import { compareTopology } from '../src/diff/compare.js';
import type { TopologyReport, RouteNode, ExternalNode, Connector } from '../src/types.js';

function makeReport(overrides: Partial<TopologyReport> = {}): TopologyReport {
  return {
    meta: {
      tool: 'shipmap',
      version: '0.3.0',
      generatedAt: new Date().toISOString(),
      framework: 'nextjs',
      projectName: 'test',
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

function makePage(path: string, extra: Partial<RouteNode> = {}): RouteNode {
  return {
    id: `page-${path}`,
    type: 'page',
    path,
    filePath: `src/app${path}/page.tsx`,
    group: '/',
    label: path,
    rendering: 'SSR',
    ...extra,
  };
}

function makeApi(path: string, extra: Partial<RouteNode> = {}): RouteNode {
  return {
    id: `api-${path}`,
    type: 'api',
    path,
    filePath: `src/app${path}/route.ts`,
    group: '/api',
    label: path,
    methods: ['GET'],
    ...extra,
  };
}

describe('compareTopology', () => {
  it('detects added nodes', () => {
    const prev = makeReport({ nodes: [makePage('/home')] });
    const curr = makeReport({ nodes: [makePage('/home'), makePage('/about')] });

    const diff = compareTopology(curr, prev);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].type).toBe('page');
    expect((diff.added[0] as RouteNode).path).toBe('/about');
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(1);
    expect(diff.summary.addedCount).toBe(1);
    expect(diff.summary.unchangedCount).toBe(1);
  });

  it('detects removed nodes', () => {
    const prev = makeReport({ nodes: [makePage('/home'), makePage('/old')] });
    const curr = makeReport({ nodes: [makePage('/home')] });

    const diff = compareTopology(curr, prev);

    expect(diff.removed).toHaveLength(1);
    expect((diff.removed[0] as RouteNode).path).toBe('/old');
    expect(diff.summary.removedCount).toBe(1);
  });

  it('detects rendering strategy changes', () => {
    const prev = makeReport({ nodes: [makePage('/home', { rendering: 'SSR' })] });
    const curr = makeReport({ nodes: [makePage('/home', { rendering: 'SSG' })] });

    const diff = compareTopology(curr, prev);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].changes).toContain('Rendering changed: SSR → SSG');
  });

  it('detects HTTP status changes', () => {
    const prev = makeReport({
      nodes: [makePage('/home', { probe: { status: 'ok', httpStatus: 200, responseTime: 100 } })],
    });
    const curr = makeReport({
      nodes: [makePage('/home', { probe: { status: 'error', httpStatus: 500, responseTime: 100 } })],
    });

    const diff = compareTopology(curr, prev);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].changes[0]).toContain('Status changed: 200 → 500');
  });

  it('detects response time changes >50%', () => {
    const prev = makeReport({
      nodes: [makePage('/home', { probe: { status: 'ok', httpStatus: 200, responseTime: 100 } })],
    });
    const curr = makeReport({
      nodes: [makePage('/home', { probe: { status: 'ok', httpStatus: 200, responseTime: 200 } })],
    });

    const diff = compareTopology(curr, prev);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].changes[0]).toContain('Response time increased');
  });

  it('ignores response time changes <50%', () => {
    const prev = makeReport({
      nodes: [makePage('/home', { probe: { status: 'ok', httpStatus: 200, responseTime: 100 } })],
    });
    const curr = makeReport({
      nodes: [makePage('/home', { probe: { status: 'ok', httpStatus: 200, responseTime: 140 } })],
    });

    const diff = compareTopology(curr, prev);

    expect(diff.unchanged).toHaveLength(1);
    expect(diff.changed).toHaveLength(0);
  });

  it('detects API method changes', () => {
    const prev = makeReport({ nodes: [makeApi('/api/users', { methods: ['GET'] })] });
    const curr = makeReport({ nodes: [makeApi('/api/users', { methods: ['GET', 'POST'] })] });

    const diff = compareTopology(curr, prev);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].changes[0]).toContain('New methods: POST');
  });

  it('detects auth status changes', () => {
    const prev = makeReport({ nodes: [makePage('/dashboard', { isProtected: false })] });
    const curr = makeReport({ nodes: [makePage('/dashboard', { isProtected: true })] });

    const diff = compareTopology(curr, prev);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].changes[0]).toContain('Now protected');
  });

  it('matches nodes by path not ID', () => {
    const prev = makeReport({ nodes: [makePage('/home')] });
    // Different id, same path
    const curr = makeReport({
      nodes: [{
        ...makePage('/home'),
        id: 'different-id',
      }],
    });

    const diff = compareTopology(curr, prev);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(1);
  });

  it('detects connector changes', () => {
    const conn1: Connector = { source: 'a', target: 'b', type: 'call', confidence: 'static', style: 'solid', color: 'green' };
    const conn2: Connector = { source: 'c', target: 'd', type: 'call', confidence: 'static', style: 'solid', color: 'green' };

    const prev = makeReport({ connectors: [conn1] });
    const curr = makeReport({ connectors: [conn2] });

    const diff = compareTopology(curr, prev);

    expect(diff.addedConnectors).toHaveLength(1);
    expect(diff.removedConnectors).toHaveLength(1);
  });

  it('tracks probe data in changes', () => {
    const prevProbe = { status: 'ok' as const, httpStatus: 200, responseTime: 100 };
    const currProbe = { status: 'error' as const, httpStatus: 500, responseTime: 100 };

    const prev = makeReport({ nodes: [makePage('/home', { probe: prevProbe })] });
    const curr = makeReport({ nodes: [makePage('/home', { probe: currProbe })] });

    const diff = compareTopology(curr, prev);

    expect(diff.changed[0].previousProbe).toEqual(prevProbe);
    expect(diff.changed[0].currentProbe).toEqual(currProbe);
  });

  it('handles external nodes', () => {
    const ext: ExternalNode = {
      id: 'ext-stripe', type: 'external', name: 'Stripe',
      label: 'Stripe', group: 'external', host: 'api.stripe.com',
      detectedFrom: 'env', referencedBy: ['/api/pay'],
    };
    const prev = makeReport({ nodes: [] });
    const curr = makeReport({ nodes: [ext] });

    const diff = compareTopology(curr, prev);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].type).toBe('external');
  });

  it('returns correct summary counts', () => {
    const prev = makeReport({
      nodes: [makePage('/home'), makePage('/old'), makePage('/changed', { rendering: 'SSR' })],
    });
    const curr = makeReport({
      nodes: [makePage('/home'), makePage('/new'), makePage('/changed', { rendering: 'SSG' })],
    });

    const diff = compareTopology(curr, prev);

    expect(diff.summary.addedCount).toBe(1);
    expect(diff.summary.removedCount).toBe(1);
    expect(diff.summary.changedCount).toBe(1);
    expect(diff.summary.unchangedCount).toBe(1);
  });
});
