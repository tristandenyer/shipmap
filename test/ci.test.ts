import { describe, expect, it } from 'vitest';
import { evaluateCi, formatCiOutput } from '../src/ci/runner.js';
import type { DiffResult } from '../src/diff/compare.js';
import type { ExternalNode, RouteNode, TopologyReport } from '../src/types.js';

const createMockReport = (overrides?: Partial<TopologyReport>): TopologyReport => ({
  meta: {
    tool: 'shipmap',
    version: '0.3.0',
    generatedAt: new Date().toISOString(),
    framework: 'nextjs',
    frameworkVersion: '14.2.0',
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
});

const createMockRoute = (overrides?: Partial<RouteNode>): RouteNode => ({
  id: 'route-1',
  type: 'api',
  path: '/api/test',
  filePath: 'src/pages/api/test.ts',
  group: 'api',
  label: 'Test Route',
  methods: ['GET'],
  ...overrides,
});

const createMockExternal = (overrides?: Partial<ExternalNode>): ExternalNode => ({
  id: 'ext-1',
  type: 'external',
  name: 'Example API',
  label: 'Example API',
  group: 'external',
  host: 'api.example.com',
  detectedFrom: 'import',
  referencedBy: [],
  ...overrides,
});

const createMockDiff = (overrides?: Partial<DiffResult>): DiffResult => ({
  added: [],
  removed: [],
  changed: [],
  unchanged: [],
  addedConnectors: [],
  removedConnectors: [],
  summary: {
    addedCount: 0,
    removedCount: 0,
    changedCount: 0,
    unchangedCount: 0,
  },
  ...overrides,
});

describe('CI Runner', () => {
  describe('evaluateCi', () => {
    it('should return exit code 0 when no errors', () => {
      const route = createMockRoute({
        probe: { status: 'ok', httpStatus: 200, responseTime: 100 },
      });
      const report = createMockReport({ nodes: [route] });

      const result = evaluateCi(report, ['errors']);

      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.summary.routesOk).toBe(1);
    });

    it('should return exit code 1 when errors found (5xx routes)', () => {
      const route = createMockRoute({
        probe: { status: 'error', httpStatus: 500, responseTime: 100 },
      });
      const report = createMockReport({ nodes: [route] });

      const result = evaluateCi(report, ['errors']);

      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].rule).toBe('errors');
      expect(result.summary.routesError).toBe(1);
    });

    it('should return exit code 1 when slow routes and "slow" rule active', () => {
      const route = createMockRoute({
        probe: { status: 'slow', httpStatus: 200, responseTime: 3000 },
      });
      const report = createMockReport({ nodes: [route] });

      const result = evaluateCi(report, ['slow'], { slowThreshold: 2000 });

      expect(result.exitCode).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].rule).toBe('slow');
      expect(result.summary.routesSlow).toBe(1);
    });

    it('should return exit code 1 for unprotected routes when "unprotected" rule active', () => {
      const route = createMockRoute({
        isProtected: false,
        probe: { status: 'ok', httpStatus: 200, responseTime: 100 },
      });
      const report = createMockReport({ nodes: [route] });

      const result = evaluateCi(report, ['unprotected']);

      expect(result.exitCode).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].rule).toBe('unprotected');
      expect(result.summary.unprotectedRoutes).toBe(1);
    });

    it('should return exit code 1 for unreachable externals when "unreachable" rule active', () => {
      const ext = createMockExternal({
        probe: { reachable: false, probedAt: new Date().toISOString() },
      });
      const report = createMockReport({ nodes: [ext] });

      const result = evaluateCi(report, ['unreachable']);

      expect(result.exitCode).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].rule).toBe('unreachable');
      expect(result.summary.unreachableExternals).toBe(1);
    });

    it('should return exit code 1 for new routes when "new-unreviewed" rule active with diff', () => {
      const newRoute = createMockRoute({ id: 'new-1', path: '/api/new' });
      const diffResult = createMockDiff({
        added: [newRoute],
        summary: { ...createMockDiff().summary, addedCount: 1 },
      });
      const report = createMockReport({ nodes: [] });

      const result = evaluateCi(report, ['new-unreviewed'], { diffResult });

      expect(result.exitCode).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].rule).toBe('new-unreviewed');
      expect(result.summary.newUnreviewedRoutes).toBe(1);
    });

    it('should return exit code 0 when failures exist but rule not in failRules', () => {
      const route = createMockRoute({
        probe: { status: 'error', httpStatus: 500, responseTime: 100 },
      });
      const report = createMockReport({ nodes: [route] });

      // Don't include 'errors' in the rules
      const result = evaluateCi(report, ['slow']);

      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
      // But summary should still track the error
      expect(result.summary.routesError).toBe(1);
    });

    it('should handle multiple failure rules', () => {
      const errorRoute = createMockRoute({
        id: 'route-error',
        path: '/api/error',
        probe: { status: 'error', httpStatus: 500, responseTime: 100 },
      });
      const slowRoute = createMockRoute({
        id: 'route-slow',
        path: '/api/slow',
        probe: { status: 'slow', httpStatus: 200, responseTime: 3000 },
      });
      const report = createMockReport({ nodes: [errorRoute, slowRoute] });

      const result = evaluateCi(report, ['errors', 'slow'], { slowThreshold: 2000 });

      expect(result.exitCode).toBe(1);
      expect(result.failures).toHaveLength(2);
      expect(result.summary.routesError).toBe(1);
      expect(result.summary.routesSlow).toBe(1);
    });

    it('should count protected routes correctly', () => {
      const protectedRoute = createMockRoute({
        id: 'route-protected',
        path: '/api/protected',
        isProtected: true,
      });
      const unprotectedRoute = createMockRoute({
        id: 'route-unprotected',
        path: '/api/unprotected',
        isProtected: false,
      });
      const report = createMockReport({ nodes: [protectedRoute, unprotectedRoute] });

      const result = evaluateCi(report, ['unprotected']);

      expect(result.failures).toHaveLength(1);
      expect(result.summary.unprotectedRoutes).toBe(1);
    });
  });

  describe('formatCiOutput', () => {
    it('should produce correct output for passing checks', () => {
      const route = createMockRoute({
        probe: { status: 'ok', httpStatus: 200, responseTime: 100 },
      });
      const report = createMockReport({ nodes: [route] });
      const result = evaluateCi(report, ['errors']);

      const output = formatCiOutput(result, report, true);

      expect(output).toContain('shipmap CI');
      expect(output).toContain('✓ 1 routes OK');
      expect(output).toContain('EXIT 0');
    });

    it('should produce correct output for failing checks', () => {
      const route = createMockRoute({
        probe: { status: 'error', httpStatus: 500, responseTime: 100 },
      });
      const report = createMockReport({ nodes: [route] });
      const result = evaluateCi(report, ['errors']);

      const output = formatCiOutput(result, report, true);

      expect(output).toContain('✗ 1 route with errors');
      expect(output).toContain('EXIT 1');
    });

    it('should include framework version in output', () => {
      const route = createMockRoute({
        probe: { status: 'ok', httpStatus: 200, responseTime: 100 },
      });
      const report = createMockReport({
        nodes: [route],
        meta: {
          ...createMockReport().meta,
          framework: 'nextjs',
          frameworkVersion: '14.2.0',
        },
      });
      const result = evaluateCi(report, ['errors']);

      const output = formatCiOutput(result, report, true);

      expect(output).toContain('nextjs 14.2.0');
    });

    it('should show minimal output when not TTY', () => {
      const route = createMockRoute({
        probe: { status: 'error', httpStatus: 500, responseTime: 100 },
      });
      const report = createMockReport({ nodes: [route] });
      const result = evaluateCi(report, ['errors']);

      const output = formatCiOutput(result, report, false);

      expect(output).toContain('shipmap CI: FAIL');
      expect(output).not.toContain('✓');
      expect(output).not.toContain('✗');
    });

    it('should display slow routes correctly', () => {
      const route = createMockRoute({
        probe: { status: 'slow', httpStatus: 200, responseTime: 3000 },
      });
      const report = createMockReport({ nodes: [route] });
      const result = evaluateCi(report, ['slow'], { slowThreshold: 2000 });

      const output = formatCiOutput(result, report, true);

      expect(output).toContain('⚠ 1 slow route');
      expect(output).toContain('3000ms');
    });

    it('should display unprotected routes correctly', () => {
      const route = createMockRoute({
        isProtected: false,
        probe: { status: 'ok', httpStatus: 200, responseTime: 100 },
      });
      const report = createMockReport({ nodes: [route] });
      const result = evaluateCi(report, ['unprotected']);

      const output = formatCiOutput(result, report, true);

      expect(output).toContain('unprotected');
    });

    it('should display external services correctly', () => {
      const ext = createMockExternal({
        probe: { reachable: true, latency: 50, probedAt: new Date().toISOString() },
      });
      const report = createMockReport({ nodes: [ext] });
      const result = evaluateCi(report, ['unreachable']);

      const output = formatCiOutput(result, report, true);

      expect(output).toContain('✓ 1 external service reachable');
    });
  });
});
