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
  </div>
  <div class="toolbar-center">
    <span class="stat">${report.summary.totalRoutes} pages</span>
    <span class="stat-sep">·</span>
    <span class="stat">${report.summary.totalApiRoutes} APIs</span>
    <span class="stat-sep">·</span>
    <span class="stat">${report.summary.totalExternals} externals</span>
    ${report.summary.totalMiddleware > 0 ? `<span class="stat-sep">·</span><span class="stat">${report.summary.protectedRoutes} protected</span>` : ''}
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
