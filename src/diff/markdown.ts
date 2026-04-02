import type { ExternalNode, MiddlewareNode, RouteNode, TopologyReport } from '../types.js';

export function generateMarkdown(report: TopologyReport): string {
  const lines: string[] = [];
  const mode = report.meta.mode;

  lines.push(`# shipmap — ${report.meta.projectName}`);
  lines.push(
    `> Generated: ${report.meta.generatedAt} | Framework: ${report.meta.framework}${report.meta.frameworkVersion ? ` ${report.meta.frameworkVersion}` : ''} | Mode: ${mode === 'probe' ? 'Probe' : 'Static'}`,
  );
  lines.push('');

  const pages = report.nodes.filter((n): n is RouteNode => n.type === 'page');
  const apis = report.nodes.filter((n): n is RouteNode => n.type === 'api');
  const middleware = report.nodes.filter((n): n is MiddlewareNode => n.type === 'middleware');
  const externals = report.nodes.filter((n): n is ExternalNode => n.type === 'external');

  // Pages
  if (pages.length > 0) {
    lines.push(`## Pages (${pages.length})`);
    if (mode === 'probe') {
      lines.push('| Route | Rendering | Status | Response Time | Auth |');
      lines.push('|-------|-----------|--------|---------------|------|');
      for (const p of pages) {
        const status = p.probe?.httpStatus ? `${p.probe.httpStatus} ${statusIcon(p.probe.httpStatus)}` : '—';
        const time = p.probe?.responseTime !== undefined ? `${p.probe.responseTime}ms` : '—';
        const auth = p.isProtected ? 'Protected' : 'Public';
        lines.push(`| \`${p.path}\` | ${p.rendering || '—'} | ${status} | ${time} | ${auth} |`);
      }
    } else {
      lines.push('| Route | Rendering | Auth |');
      lines.push('|-------|-----------|------|');
      for (const p of pages) {
        const auth = p.isProtected ? 'Protected' : 'Public';
        lines.push(`| \`${p.path}\` | ${p.rendering || '—'} | ${auth} |`);
      }
    }
    lines.push('');
  }

  // API Routes
  if (apis.length > 0) {
    lines.push(`## API Routes (${apis.length})`);
    if (mode === 'probe') {
      lines.push('| Route | Methods | Status | Response Time | Auth |');
      lines.push('|-------|---------|--------|---------------|------|');
      for (const a of apis) {
        const methods = a.methods?.join(', ') || '—';
        const status = a.probe?.httpStatus ? `${a.probe.httpStatus} ${statusIcon(a.probe.httpStatus)}` : '—';
        const time = a.probe?.responseTime !== undefined ? `${a.probe.responseTime}ms` : '—';
        const auth = a.isProtected ? 'Protected' : 'Public';
        lines.push(`| \`${a.path}\` | ${methods} | ${status} | ${time} | ${auth} |`);
      }
    } else {
      lines.push('| Route | Methods | Auth |');
      lines.push('|-------|---------|------|');
      for (const a of apis) {
        const methods = a.methods?.join(', ') || '—';
        const auth = a.isProtected ? 'Protected' : 'Public';
        lines.push(`| \`${a.path}\` | ${methods} | ${auth} |`);
      }
    }
    lines.push('');
  }

  // Middleware
  if (middleware.length > 0) {
    lines.push(`## Middleware (${middleware.length})`);
    lines.push('| File | Matches | Auth Provider | Runtime |');
    lines.push('|------|---------|---------------|---------|');
    for (const mw of middleware) {
      const matches = mw.matcherPatterns.length > 0 ? mw.matcherPatterns.join(', ') : 'all routes';
      lines.push(`| \`${mw.filePath}\` | ${matches} | ${mw.authProvider || '—'} | ${mw.runtime} |`);
    }
    lines.push('');
  }

  // External Services
  if (externals.length > 0) {
    lines.push(`## External Services (${externals.length})`);
    if (mode === 'probe') {
      lines.push('| Service | Detected From | Reachable | Latency | Used By |');
      lines.push('|---------|--------------|-----------|---------|---------|');
      for (const ext of externals) {
        const reachable = ext.probe ? (ext.probe.reachable ? '\u2713' : '\u2717') : '—';
        const latency = ext.probe?.latency ? `${ext.probe.latency}ms` : '—';
        const usedBy = `${ext.referencedBy.length} routes`;
        lines.push(`| ${ext.name} | ${ext.detectedFrom} | ${reachable} | ${latency} | ${usedBy} |`);
      }
    } else {
      lines.push('| Service | Detected From | Used By |');
      lines.push('|---------|--------------|---------|');
      for (const ext of externals) {
        const usedBy = `${ext.referencedBy.length} routes`;
        lines.push(`| ${ext.name} | ${ext.detectedFrom} | ${usedBy} |`);
      }
    }
    lines.push('');
  }

  // Summary
  lines.push('## Summary');
  const total = pages.length + apis.length + middleware.length + externals.length;
  lines.push(
    `- **${total} routes** (${pages.length} pages, ${apis.length} API, ${middleware.length} middleware, ${externals.length} external services)`,
  );

  if (mode === 'probe') {
    const allRoutes = [...pages, ...apis];
    const ok = allRoutes.filter((n) => n.probe?.status === 'ok').length;
    const slow = allRoutes.filter((n) => n.probe?.status === 'slow').length;
    const errors = allRoutes.filter((n) => n.probe?.status === 'error').length;
    const notProbed = allRoutes.filter((n) => !n.probe || n.probe.status === 'not-probed').length;
    lines.push(`- **${ok} OK**, ${slow} slow, ${errors} errors, ${notProbed} not probed`);
  }

  const protectedCount = report.summary.protectedRoutes;
  if (protectedCount > 0) {
    lines.push(`- ${protectedCount} protected routes`);
  }

  lines.push('');
  return lines.join('\n');
}

function statusIcon(httpStatus: number): string {
  if (httpStatus >= 200 && httpStatus < 400) return '\u2713';
  if (httpStatus >= 400 && httpStatus < 500) return '\u26a0';
  return '\u2717';
}
