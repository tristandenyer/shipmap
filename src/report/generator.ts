import type { TopologyReport } from '../types.js';
import type { DiffResult } from '../diff/compare.js';
import { getStyles } from './styles.js';
import { getCanvasScript } from './canvas.js';

export function generateReport(report: TopologyReport, diff?: DiffResult): string {
  const dataJson = JSON.stringify(report);
  const diffJson = diff ? JSON.stringify(diff) : 'null';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>shipmap — ${escapeHtml(report.meta.projectName)}</title>
<style>${getStyles()}</style>
</head>
<body>
<div id="stale-banner" class="hidden"></div>

<div id="toolbar">
  <div class="toolbar-left">
    <span class="logo">⚓ shipmap</span>
    <span class="project-name">${escapeHtml(report.meta.projectName)}</span>
    <span class="framework-badge">${escapeHtml(report.meta.framework)}${report.meta.frameworkVersion ? ' v' + escapeHtml(report.meta.frameworkVersion) : ''}</span>
    <span class="mode-badge ${report.meta.mode}">${report.meta.mode === 'probe' ? 'Probe mode' : 'Static mode'}</span>
    ${diff ? `<span class="diff-summary">${getDiffSummary(diff)}</span>` : ''}
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
    <div class="search-wrapper">
      <span class="search-icon">&#x1F50D;</span>
      <input id="search-input" type="text" placeholder="Search routes... (/)" autocomplete="off" />
      <button class="search-clear" id="search-clear">&times;</button>
    </div>
    <span class="search-count" id="search-count"></span>
    <button id="btn-copy-md" title="Copy as Markdown">MD</button>
    <button id="btn-fit" title="Fit to view (F)">&#8862;</button>
    <button id="btn-zoom-in" title="Zoom in">+</button>
    <button id="btn-zoom-out" title="Zoom out">&minus;</button>
    <button id="btn-shortcuts" title="Keyboard shortcuts (?)">?</button>
    <span class="generated">${new Date(report.meta.generatedAt).toLocaleString()}</span>
  </div>
</div>

<div id="filter-bar">
  <div class="filter-group">
    <span class="filter-group-label">Type</span>
    <button class="filter-btn active" data-filter-type="all">All</button>
    <button class="filter-btn" data-filter-type="page">Pages</button>
    <button class="filter-btn" data-filter-type="api">API</button>
    <button class="filter-btn" data-filter-type="middleware">Middleware</button>
    <button class="filter-btn" data-filter-type="external">External</button>
  </div>
  <div class="filter-sep"></div>
  ${report.meta.mode === 'probe' ? `
  <div class="filter-group">
    <span class="filter-group-label">Status</span>
    <button class="filter-btn active" data-filter-status="all">All</button>
    <button class="filter-btn" data-filter-status="ok">OK</button>
    <button class="filter-btn" data-filter-status="slow">Slow</button>
    <button class="filter-btn" data-filter-status="error">Errors</button>
  </div>
  <div class="filter-sep"></div>
  ` : ''}
  <div class="filter-group">
    <span class="filter-group-label">Rendering</span>
    <button class="filter-btn active" data-filter-rendering="all">All</button>
    <button class="filter-btn" data-filter-rendering="SSR">SSR</button>
    <button class="filter-btn" data-filter-rendering="SSG">SSG</button>
    <button class="filter-btn" data-filter-rendering="ISR">ISR</button>
    <button class="filter-btn" data-filter-rendering="Edge">Edge</button>
    <button class="filter-btn" data-filter-rendering="Static">Static</button>
    <button class="filter-btn" data-filter-rendering="Client">Client</button>
  </div>
</div>

<div id="canvas-container" class="with-filters">
  <svg id="connectors-svg"></svg>
  <div id="canvas"></div>
</div>

<div id="detail-panel" class="hidden with-filters">
  <div class="panel-header">
    <span id="panel-title"></span>
    <button id="panel-close">&#10005;</button>
  </div>
  <div id="panel-content"></div>
</div>

<div id="toast-container"></div>

<div id="shortcut-overlay" class="hidden">
  <div class="shortcut-panel">
    <h3>Keyboard Shortcuts</h3>
    <div class="shortcut-grid">
      <div class="shortcut-row"><span class="shortcut-key">F</span><span class="shortcut-desc">Fit all to viewport</span></div>
      <div class="shortcut-row"><span class="shortcut-key">Esc</span><span class="shortcut-desc">Close panel / search</span></div>
      <div class="shortcut-row"><span class="shortcut-key">/</span><span class="shortcut-desc">Focus search</span></div>
      <div class="shortcut-row"><span class="shortcut-key">&#8593; &#8595;</span><span class="shortcut-desc">Navigate nodes</span></div>
      <div class="shortcut-row"><span class="shortcut-key">&#8592; &#8594;</span><span class="shortcut-desc">Navigate groups</span></div>
      <div class="shortcut-row"><span class="shortcut-key">Enter</span><span class="shortcut-desc">Open detail panel</span></div>
      <div class="shortcut-row"><span class="shortcut-key">C</span><span class="shortcut-desc">Copy route path</span></div>
      ${report.meta.mode === 'probe' ? '<div class="shortcut-row"><span class="shortcut-key">O</span><span class="shortcut-desc">Open in browser</span></div>' : ''}
      <div class="shortcut-row"><span class="shortcut-key">G</span><span class="shortcut-desc">Toggle group</span></div>
      <div class="shortcut-row"><span class="shortcut-key">?</span><span class="shortcut-desc">Toggle this overlay</span></div>
      <div class="shortcut-row"><span class="shortcut-key">1</span><span class="shortcut-desc">Show all</span></div>
      <div class="shortcut-row"><span class="shortcut-key">2</span><span class="shortcut-desc">Pages only</span></div>
      <div class="shortcut-row"><span class="shortcut-key">3</span><span class="shortcut-desc">API only</span></div>
      <div class="shortcut-row"><span class="shortcut-key">4</span><span class="shortcut-desc">Errors only</span></div>
    </div>
  </div>
</div>

<script>
const REPORT = ${dataJson};
const DIFF = ${diffJson};
${getCanvasScript()}
</script>
</body>
</html>`;
}

function getDiffSummary(diff: DiffResult): string {
  const parts: string[] = [];
  if (diff.summary.addedCount > 0) parts.push(`<span class="added">+${diff.summary.addedCount} new</span>`);
  if (diff.summary.removedCount > 0) parts.push(`<span class="removed">-${diff.summary.removedCount} removed</span>`);
  if (diff.summary.changedCount > 0) parts.push(`<span class="changed">${diff.summary.changedCount} changed</span>`);
  parts.push(`${diff.summary.unchangedCount} unchanged`);
  return parts.join(' &middot; ');
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
