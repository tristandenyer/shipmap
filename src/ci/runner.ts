import type { TopologyReport, RouteNode, ExternalNode } from '../types.js';
import type { DiffResult } from '../diff/compare.js';

export interface CiFailure {
  rule: string;
  message: string;
  path?: string;
  details?: string;
}

export interface CiResult {
  passed: boolean;
  exitCode: 0 | 1 | 2;
  failures: CiFailure[];
  summary: {
    routesOk: number;
    routesError: number;
    routesSlow: number;
    unprotectedRoutes: number;
    unreachableExternals: number;
    newUnreviewedRoutes: number;
  };
}

export type CiFailRule = 'errors' | 'slow' | 'unprotected' | 'unreachable' | 'new-unreviewed';

export interface CiOptions {
  slowThreshold?: number;
  diffResult?: DiffResult;
  protectedRouteIds?: Set<string>;
}

export function evaluateCi(
  report: TopologyReport,
  failRules: CiFailRule[],
  options: CiOptions = {},
): CiResult {
  const failures: CiFailure[] = [];
  const summary = {
    routesOk: 0,
    routesError: 0,
    routesSlow: 0,
    unprotectedRoutes: 0,
    unreachableExternals: 0,
    newUnreviewedRoutes: 0,
  };

  const slowThreshold = options.slowThreshold ?? 2000;
  const diffResult = options.diffResult;
  const protectedRouteIds = options.protectedRouteIds ?? new Set();

  // Extract route nodes
  const routeNodes = report.nodes.filter(
    (n): n is RouteNode => n.type === 'page' || n.type === 'api',
  );
  const externalNodes = report.nodes.filter(
    (n): n is ExternalNode => n.type === 'external',
  );

  // Check errors (5xx routes)
  if (failRules.includes('errors')) {
    for (const route of routeNodes) {
      if (route.probe?.status === 'error') {
        const status = route.probe.httpStatus || '5xx';
        const statusText = route.probe.httpStatus === 0 ? 'TIMEOUT' : `${status}`;
        failures.push({
          rule: 'errors',
          message: `${route.path} (${route.methods?.join(', ') || 'GET'} → ${statusText})`,
          path: route.path,
          details: route.probe.responseTime ? `${route.probe.responseTime}ms` : undefined,
        });
        summary.routesError++;
      } else if (route.probe?.status === 'ok' || route.probe?.status === 'warn') {
        summary.routesOk++;
      }
    }
  } else {
    // Count OK routes even if not checking errors
    for (const route of routeNodes) {
      if (route.probe?.status === 'ok' || route.probe?.status === 'warn') {
        summary.routesOk++;
      } else if (route.probe?.status === 'error') {
        summary.routesError++;
      }
    }
  }

  // Check slow routes
  if (failRules.includes('slow')) {
    for (const route of routeNodes) {
      if (route.probe?.status === 'slow' || (route.probe?.responseTime && route.probe.responseTime > slowThreshold)) {
        failures.push({
          rule: 'slow',
          message: `${route.path} (${route.methods?.join(', ') || 'GET'} → ${route.probe?.httpStatus || 200} OK, ${route.probe?.responseTime}ms)`,
          path: route.path,
          details: `${route.probe?.responseTime}ms (threshold: ${slowThreshold}ms)`,
        });
        summary.routesSlow++;
      }
    }
  } else {
    // Count slow routes even if not checking
    for (const route of routeNodes) {
      if (route.probe?.status === 'slow' || (route.probe?.responseTime && route.probe.responseTime > slowThreshold)) {
        summary.routesSlow++;
      }
    }
  }

  // Check unprotected routes
  if (failRules.includes('unprotected')) {
    for (const route of routeNodes) {
      if (!route.isProtected && !protectedRouteIds.has(route.id)) {
        failures.push({
          rule: 'unprotected',
          message: `${route.path} detected without middleware/auth coverage`,
          path: route.path,
        });
        summary.unprotectedRoutes++;
      }
    }
  } else {
    // Count unprotected routes even if not checking
    for (const route of routeNodes) {
      if (!route.isProtected && !protectedRouteIds.has(route.id)) {
        summary.unprotectedRoutes++;
      }
    }
  }

  // Check unreachable externals
  if (failRules.includes('unreachable')) {
    for (const ext of externalNodes) {
      if (ext.probe && !ext.probe.reachable) {
        failures.push({
          rule: 'unreachable',
          message: `${ext.name}: host unreachable${ext.host ? ` (${ext.host})` : ''}`,
          details: `last checked: ${ext.probe.probedAt || 'unknown'}`,
        });
        summary.unreachableExternals++;
      }
    }
  } else {
    // Count unreachable externals even if not checking
    for (const ext of externalNodes) {
      if (ext.probe && !ext.probe.reachable) {
        summary.unreachableExternals++;
      }
    }
  }

  // Check new unreviewed routes
  if (failRules.includes('new-unreviewed') && diffResult) {
    for (const added of diffResult.added) {
      if (added.type === 'page' || added.type === 'api') {
        failures.push({
          rule: 'new-unreviewed',
          message: `New route found: ${added.path}`,
          path: added.path,
        });
        summary.newUnreviewedRoutes++;
      }
    }
  } else if (diffResult) {
    // Count new routes even if not checking
    for (const added of diffResult.added) {
      if (added.type === 'page' || added.type === 'api') {
        summary.newUnreviewedRoutes++;
      }
    }
  }

  const passed = failures.length === 0;
  const exitCode: 0 | 1 | 2 = passed ? 0 : 1;

  return {
    passed,
    exitCode,
    failures,
    summary,
  };
}

export function formatCiOutput(
  result: CiResult,
  report: TopologyReport,
  isTTY: boolean,
): string {
  if (!isTTY) {
    // Minimal output when piped
    const lines: string[] = [];
    if (result.exitCode === 0) {
      lines.push(`shipmap CI: PASS (${result.summary.routesOk} routes OK)`);
    } else {
      lines.push(`shipmap CI: FAIL (${result.failures.length} failures)`);
      for (const failure of result.failures) {
        lines.push(`  ${failure.rule}: ${failure.message}`);
      }
      lines.push(`\nEXIT ${result.exitCode}: ${result.failures.length} ${result.failures.length === 1 ? 'failure' : 'failures'} found`);
    }
    return lines.join('\n');
  }

  // TTY output with formatting
  const lines: string[] = [];
  const fw = report.meta.framework;
  const fwVersion = report.meta.frameworkVersion ? ` ${report.meta.frameworkVersion}` : '';

  lines.push(`\n  shipmap CI — ${fw}${fwVersion}\n`);

  // Routes OK
  if (result.summary.routesOk > 0) {
    lines.push(`  ✓ ${result.summary.routesOk} routes OK`);
  }

  // Routes with errors
  const errorFailures = result.failures.filter((f) => f.rule === 'errors');
  if (errorFailures.length > 0) {
    lines.push(`  ✗ ${errorFailures.length} route${errorFailures.length === 1 ? '' : 's'} with errors:`);
    for (const failure of errorFailures) {
      lines.push(`    ${failure.message}`);
    }
  }

  // Slow routes
  const slowFailures = result.failures.filter((f) => f.rule === 'slow');
  if (slowFailures.length > 0) {
    lines.push(`  ⚠ ${slowFailures.length} slow route${slowFailures.length === 1 ? '' : 's'}:`);
    for (const failure of slowFailures) {
      lines.push(`    ${failure.message}`);
    }
  }

  // Unprotected routes
  const unprotectedFailures = result.failures.filter((f) => f.rule === 'unprotected');
  if (unprotectedFailures.length > 0) {
    lines.push(`  ⚠ ${unprotectedFailures.length} unprotected route${unprotectedFailures.length === 1 ? '' : 's'}:`);
    for (const failure of unprotectedFailures) {
      lines.push(`    ${failure.message}`);
    }
  }

  // Unreachable externals
  const unreachableFailures = result.failures.filter((f) => f.rule === 'unreachable');
  if (unreachableFailures.length > 0) {
    lines.push(`  ✗ ${unreachableFailures.length} external service${unreachableFailures.length === 1 ? '' : 's'} unreachable`);
  } else {
    const externalCount = report.nodes.filter((n) => n.type === 'external').length;
    if (externalCount > 0) {
      lines.push(`  ✓ ${externalCount} external service${externalCount === 1 ? '' : 's'} reachable`);
    }
  }

  // New unreviewed routes
  const newFailures = result.failures.filter((f) => f.rule === 'new-unreviewed');
  if (newFailures.length > 0) {
    lines.push(`  ⓘ ${newFailures.length} new route${newFailures.length === 1 ? '' : 's'} (unreviewed):`);
    for (const failure of newFailures) {
      lines.push(`    ${failure.message}`);
    }
  }

  // Exit summary
  if (result.exitCode === 0) {
    lines.push(`\n  EXIT 0: All checks passed`);
  } else {
    const failureCount = result.failures.length;
    lines.push(`\n  EXIT ${result.exitCode}: ${failureCount} ${failureCount === 1 ? 'failure' : 'failures'} found`);
  }

  lines.push('');

  return lines.join('\n');
}
