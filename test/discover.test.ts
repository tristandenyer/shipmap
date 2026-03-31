import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { discover } from '../src/discover/index.js';

const fixtures = join(__dirname, 'fixtures');

describe('discover (orchestrator)', () => {
  it('produces a full topology report for App Router project', async () => {
    const report = await discover(join(fixtures, 'nextjs-app-router'));

    expect(report.meta.tool).toBe('shipmap');
    expect(report.meta.framework).toBe('nextjs');
    expect(report.meta.projectName).toBe('test-nextjs-app');
    expect(report.meta.mode).toBe('static');

    // Should find pages, APIs, middleware, and externals
    expect(report.summary.totalRoutes).toBeGreaterThan(0);
    expect(report.summary.totalApiRoutes).toBeGreaterThan(0);
    expect(report.summary.totalMiddleware).toBe(1);
    expect(report.summary.totalExternals).toBeGreaterThan(0);

    // Nodes should include all types
    const types = new Set(report.nodes.map(n => n.type));
    expect(types.has('page')).toBe(true);
    expect(types.has('api')).toBe(true);
    expect(types.has('middleware')).toBe(true);
    expect(types.has('external')).toBe(true);

    // Should have connectors
    expect(report.connectors.length).toBeGreaterThan(0);

    // Groups should be populated
    expect(Object.keys(report.groups).length).toBeGreaterThan(0);
  });

  it('produces a report for Pages Router project', async () => {
    const report = await discover(join(fixtures, 'nextjs-pages-router'));
    expect(report.summary.totalRoutes).toBeGreaterThan(0);
    expect(report.summary.totalApiRoutes).toBeGreaterThan(0);
    expect(report.summary.totalMiddleware).toBe(0);
  });

  it('produces a report for mixed project', async () => {
    const report = await discover(join(fixtures, 'nextjs-mixed'));
    expect(report.summary.totalRoutes).toBeGreaterThan(0);
    expect(report.summary.totalApiRoutes).toBeGreaterThan(0);
  });

  it('throws for unsupported framework', async () => {
    // Create a temp scenario — the pages-router fixture has next, so this works
    // Instead, test that it throws for a non-nextjs project
    await expect(discover('/tmp')).rejects.toThrow();
  });

  it('includes rendering breakdown in summary', async () => {
    const report = await discover(join(fixtures, 'nextjs-app-router'));
    expect(report.summary.renderingBreakdown).toBeDefined();
    const strategies = Object.keys(report.summary.renderingBreakdown);
    expect(strategies.length).toBeGreaterThan(0);
  });
});
