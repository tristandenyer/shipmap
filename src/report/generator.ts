import type { TopologyReport } from '../types.js';
import { getStyles } from './styles.js';
import { getCanvasScript } from './canvas.js';

export function generateReport(report: TopologyReport): string {
  const dataJson = JSON.stringify(report);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>shipmap — ${escapeHtml(report.meta.projectName)}</title>
<style>${getStyles()}</style>
</head>
<body>
<div id="toolbar">
  <div class="toolbar-left">
    <span class="logo">⚓ shipmap</span>
    <span class="project-name">${escapeHtml(report.meta.projectName)}</span>
    <span class="framework-badge">${escapeHtml(report.meta.framework)}${report.meta.frameworkVersion ? ' v' + escapeHtml(report.meta.frameworkVersion) : ''}</span>
    <span class="mode-badge ${report.meta.mode}">${report.meta.mode === 'probe' ? 'Probe mode' : 'Static mode'}</span>
  </div>
  <div class="toolbar-center">
    <span class="stat">${report.summary.totalRoutes} pages</span>
    <span class="stat-sep">·</span>
    <span class="stat">${report.summary.totalApiRoutes} APIs</span>
    <span class="stat-sep">·</span>
    <span class="stat">${report.summary.totalExternals} externals</span>
    ${report.summary.totalMiddleware > 0 ? `<span class="stat-sep">·</span><span class="stat">${report.summary.protectedRoutes} protected</span>` : ''}
    ${report.meta.mode === 'probe' ? `<span class="stat-sep">·</span><span class="probe-summary">${getProbeSummary(report)}</span>` : ''}
  </div>
  <div class="toolbar-right">
    <button id="btn-fit" title="Fit to view (F)">⊞</button>
    <button id="btn-zoom-in" title="Zoom in">+</button>
    <button id="btn-zoom-out" title="Zoom out">−</button>
    <span class="generated">${new Date(report.meta.generatedAt).toLocaleString()}</span>
  </div>
</div>

<div id="canvas-container">
  <svg id="connectors-svg"></svg>
  <div id="canvas"></div>
</div>

<div id="detail-panel" class="hidden">
  <div class="panel-header">
    <span id="panel-title"></span>
    <button id="panel-close">✕</button>
  </div>
  <div id="panel-content"></div>
</div>

<script>
const REPORT = ${dataJson};
${getCanvasScript()}
</script>
</body>
</html>`;
}

function getProbeSummary(report: TopologyReport): string {
  const routes = report.nodes.filter(
    (n) => n.type === 'page' || n.type === 'api',
  );
  let ok = 0, errors = 0, slow = 0, notProbed = 0;
  for (const n of routes) {
    const probe = (n as any).probe;
    if (!probe) { notProbed++; continue; }
    if (probe.status === 'ok') ok++;
    else if (probe.status === 'error') errors++;
    else if (probe.status === 'slow') slow++;
    else if (probe.status === 'not-probed') notProbed++;
  }
  const parts: string[] = [];
  if (ok > 0) parts.push(`<span class="ok">${ok} OK</span>`);
  if (errors > 0) parts.push(`<span class="error">${errors} errors</span>`);
  if (slow > 0) parts.push(`<span class="slow">${slow} slow</span>`);
  if (notProbed > 0) parts.push(`${notProbed} skipped`);
  return parts.join(', ');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
