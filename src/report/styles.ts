export function getStyles(): string {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #0f1117;
  --surface: #1a1d27;
  --surface-hover: #252836;
  --border: #2e3140;
  --text: #e4e5e9;
  --text-muted: #8b8d98;
  --accent: #6c8cff;
  --accent-dim: #4a6ad4;
  --page: #3b82f6;
  --api: #22c55e;
  --middleware: #f59e0b;
  --external: #a855f7;
  --ssr: #ef4444;
  --ssg: #22c55e;
  --isr: #f59e0b;
  --edge: #06b6d4;
  --static: #8b8d98;
  --client: #ec4899;
}
html, body { height: 100%; overflow: hidden; font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; background: var(--bg); color: var(--text); }

/* Toolbar */
#toolbar {
  position: fixed; top: 0; left: 0; right: 0; height: 48px; z-index: 100;
  background: var(--surface); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between; padding: 0 16px;
}
.toolbar-left { display: flex; align-items: center; gap: 12px; }
.logo { font-weight: 700; font-size: 15px; color: var(--accent); }
.project-name { font-size: 13px; color: var(--text); }
.framework-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 4px;
  background: var(--accent-dim); color: #fff;
}
.toolbar-center { display: flex; align-items: center; gap: 6px; }
.stat { font-size: 12px; color: var(--text-muted); }
.stat-sep { color: var(--border); }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.toolbar-right button {
  width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 4px;
  background: var(--surface); color: var(--text); cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.toolbar-right button:hover { background: var(--surface-hover); }
.generated { font-size: 10px; color: var(--text-muted); }

/* Canvas */
#canvas-container {
  position: fixed; top: 48px; left: 0; right: 0; bottom: 0;
  overflow: hidden; cursor: grab;
}
#canvas-container.dragging { cursor: grabbing; }
#connectors-svg {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 1;
}
#connectors-svg g { pointer-events: auto; }
#canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; z-index: 2; }

/* Filter bar */
#filter-bar {
  position: fixed; top: 48px; left: 0; right: 0; height: 36px; z-index: 99;
  background: var(--bg); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 6px; padding: 0 16px;
  font-size: 11px;
}
#filter-bar.hidden { display: none; }
.filter-group { display: flex; align-items: center; gap: 3px; }
.filter-group-label { color: var(--text-muted); margin-right: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.filter-sep { width: 1px; height: 20px; background: var(--border); margin: 0 8px; }
.filter-btn {
  padding: 2px 8px; border-radius: 3px; border: 1px solid var(--border);
  background: transparent; color: var(--text-muted); cursor: pointer;
  font-size: 10px; font-family: inherit; transition: all 0.15s;
}
.filter-btn:hover { background: var(--surface-hover); color: var(--text); }
.filter-btn.active { background: var(--accent-dim); color: #fff; border-color: var(--accent); }

/* Canvas offset when filter bar visible */
#canvas-container.with-filters { top: 84px; }

/* Nodes */
.node {
  position: absolute; padding: 10px 14px; border-radius: 8px;
  background: var(--surface); border: 1px solid var(--border);
  cursor: pointer; user-select: none; min-width: 140px;
  transition: box-shadow 0.15s, border-color 0.15s, opacity 0.15s;
}
.node:hover { border-color: var(--accent); box-shadow: 0 0 12px rgba(108,140,255,0.2); }
.node.selected { border-color: var(--accent); box-shadow: 0 0 20px rgba(108,140,255,0.3); }
.node.focused { outline: 2px solid #06b6d4; outline-offset: 2px; }
.node.filtered-out { opacity: 0.2; pointer-events: none; }
.node-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.node-type {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  padding: 1px 5px; border-radius: 3px;
}
.node-type.page { background: var(--page); color: #fff; }
.node-type.api { background: var(--api); color: #000; }
.node-type.middleware { background: var(--middleware); color: #000; }
.node-type.external { background: var(--external); color: #fff; }
.node-label { font-size: 13px; font-weight: 500; white-space: nowrap; }
.node-meta { font-size: 10px; color: var(--text-muted); margin-top: 2px; display: flex; gap: 6px; flex-wrap: wrap; }
.rendering-badge {
  font-size: 9px; padding: 1px 4px; border-radius: 2px; font-weight: 600;
}
.rendering-badge.ssr { background: var(--ssr); color: #fff; }
.rendering-badge.ssg { background: var(--ssg); color: #000; }
.rendering-badge.isr { background: var(--isr); color: #000; }
.rendering-badge.edge { background: var(--edge); color: #000; }
.rendering-badge.static { background: var(--static); color: #fff; }
.rendering-badge.client { background: var(--client); color: #fff; }
.method-badge {
  font-size: 9px; padding: 1px 4px; border-radius: 2px; font-weight: 600;
  background: var(--surface-hover); color: var(--api);
}

/* Node action buttons */
.node-actions {
  position: absolute; top: 4px; right: 4px; display: flex; gap: 2px; z-index: 5;
}
.node-action-btn {
  width: 18px; height: 18px; border: none; border-radius: 3px;
  background: transparent; color: var(--text-muted); cursor: pointer;
  font-size: 10px; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.15s, background 0.15s;
}
.node:hover .node-action-btn { opacity: 0.7; }
.node-action-btn:hover { opacity: 1 !important; background: var(--surface-hover); }

/* Diff badges */
.diff-badge {
  position: absolute; top: -6px; right: -6px; font-size: 8px; font-weight: 700;
  padding: 1px 5px; border-radius: 3px; text-transform: uppercase; z-index: 5;
}
.diff-badge.new { background: var(--api); color: #000; }
.diff-badge.changed { background: var(--middleware); color: #000; }
.node.diff-added { box-shadow: 0 0 12px rgba(34,197,94,0.4); }
.node.diff-changed {
  border-color: rgba(245,158,11,0.6);
  animation: pulse-amber 2s ease-in-out infinite;
}
.node.diff-removed {
  opacity: 0.3; border-color: rgba(239,68,68,0.4);
  pointer-events: none;
}
.node.diff-removed .node-label { text-decoration: line-through; }
@keyframes pulse-amber {
  0%, 100% { box-shadow: 0 0 0 rgba(245,158,11,0); }
  50% { box-shadow: 0 0 12px rgba(245,158,11,0.3); }
}

/* Diff connectors */
.connector-path.diff-added { stroke: var(--api); stroke-width: 2.5; opacity: 0.8; }
.connector-path.diff-removed { stroke: var(--ssr); stroke-dasharray: 6 4; opacity: 0.3; }
.connector-path.filtered-out { opacity: 0.1; }

/* Probe status indicators */
.node-status {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px;
}
.node-status.ok { background: var(--api); box-shadow: 0 0 6px var(--api); }
.node-status.slow { background: var(--middleware); box-shadow: 0 0 6px var(--middleware); }
.node-status.error { background: var(--ssr); box-shadow: 0 0 6px var(--ssr); }
.node-status.not-probed { background: var(--static); }
.node-status.external { background: var(--external); }

.node.probe-ok { border-color: rgba(34,197,94,0.4); }
.node.probe-slow { border-color: rgba(245,158,11,0.4); }
.node.probe-error { border-color: rgba(239,68,68,0.4); }

.probe-badge {
  font-size: 9px; padding: 1px 4px; border-radius: 2px; font-weight: 600;
}
.probe-badge.ok { background: rgba(34,197,94,0.2); color: var(--api); }
.probe-badge.slow { background: rgba(245,158,11,0.2); color: var(--middleware); }
.probe-badge.error { background: rgba(239,68,68,0.2); color: var(--ssr); }

.probe-time { font-size: 9px; color: var(--text-muted); }

/* Probe mode toolbar */
.mode-badge {
  font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600;
}
.mode-badge.static { background: var(--surface-hover); color: var(--text-muted); }
.mode-badge.probe { background: rgba(34,197,94,0.2); color: var(--api); }
.probe-summary { font-size: 11px; color: var(--text-muted); }
.probe-summary .ok { color: var(--api); }
.probe-summary .error { color: var(--ssr); }
.probe-summary .slow { color: var(--middleware); }

/* Diff summary in toolbar */
.diff-summary { font-size: 11px; color: var(--text-muted); }
.diff-summary .added { color: var(--api); }
.diff-summary .removed { color: var(--ssr); }
.diff-summary .changed { color: var(--middleware); }

/* Method results in detail panel */
.method-result { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12px; }
.method-result .method { font-weight: 600; width: 50px; }
.method-result .status-ok { color: var(--api); }
.method-result .status-error { color: var(--ssr); }
.method-result .status-slow { color: var(--middleware); }
.method-result .time { color: var(--text-muted); font-size: 10px; }

/* Diff changes in detail panel */
.diff-changes { margin-top: 8px; padding: 8px; background: rgba(245,158,11,0.1); border-radius: 6px; border: 1px solid rgba(245,158,11,0.2); }
.diff-changes-title { font-size: 10px; font-weight: 600; color: var(--middleware); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.diff-change-item { font-size: 11px; color: var(--text); padding: 2px 0; }

/* Search bar */
.search-wrapper {
  position: relative; display: flex; align-items: center;
}
.search-icon {
  position: absolute; left: 8px; font-size: 12px; color: var(--text-muted); pointer-events: none;
}
#search-input {
  width: 180px; height: 28px; padding: 0 28px 0 26px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
  color: var(--text); font-size: 11px; font-family: inherit;
  outline: none; transition: border-color 0.15s;
}
#search-input:focus { border-color: var(--accent); }
#search-input::placeholder { color: var(--text-muted); }
.search-clear {
  position: absolute; right: 6px; background: none; border: none;
  color: var(--text-muted); cursor: pointer; font-size: 12px; padding: 2px;
  display: none;
}
.search-clear.visible { display: block; }
.search-count { font-size: 10px; color: var(--text-muted); margin-left: 6px; white-space: nowrap; }

/* Group labels */
.group-label {
  position: absolute; font-size: 11px; font-weight: 600;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;
  cursor: pointer; opacity: 0.6; z-index: 3;
  display: flex; align-items: center; gap: 6px;
  padding: 2px 6px; border-radius: 4px;
  transition: opacity 0.15s, background 0.15s;
}
.group-label:hover { opacity: 1; background: rgba(255,255,255,0.05); }
.group-label .collapse-icon {
  display: inline-block; font-size: 9px; transition: transform 0.2s;
}
.group-label.collapsed .collapse-icon { transform: rotate(-90deg); }
.group-label .group-count {
  font-size: 9px; color: var(--text-muted); font-weight: 400; opacity: 0.7;
}
.group-box {
  position: absolute; border: 1px dashed var(--border); border-radius: 12px;
  pointer-events: none; opacity: 0.4;
  transition: opacity 0.2s, height 0.2s;
}
.group-box.collapsed { opacity: 0.2; }

/* Detail Panel */
#detail-panel {
  position: fixed; top: 48px; right: 0; bottom: 0; width: 320px; z-index: 50;
  background: var(--surface); border-left: 1px solid var(--border);
  overflow-y: auto; transition: transform 0.2s;
}
#detail-panel.hidden { transform: translateX(100%); }
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px; border-bottom: 1px solid var(--border);
}
#panel-title { font-size: 14px; font-weight: 600; }
#panel-close {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  font-size: 16px; padding: 4px;
}
#panel-close:hover { color: var(--text); }
#panel-content { padding: 16px; }
#panel-content .field { margin-bottom: 12px; }
#panel-content .field-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
#panel-content .field-value { font-size: 13px; }
#panel-content .connector-list { list-style: none; }
#panel-content .connector-list li { font-size: 12px; padding: 4px 0; color: var(--text-muted); }

/* SVG connectors */
.connector-path {
  fill: none; stroke-width: 1.5; opacity: 0.5;
}
.connector-path:hover { opacity: 1; stroke-width: 2.5; }
.connector-path.green { stroke: var(--api); }
.connector-path.amber { stroke: var(--middleware); }
.connector-path.orange { stroke: var(--middleware); }
.connector-path.red { stroke: var(--ssr); }
.connector-path.blue { stroke: var(--accent); }
.connector-path.grey { stroke: var(--text-muted); }
.connector-path.dashed { stroke-dasharray: 6 4; }

/* Toast notifications */
#toast-container {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  z-index: 200; display: flex; flex-direction: column-reverse; gap: 8px;
  align-items: center; pointer-events: none;
}
.toast {
  padding: 8px 16px; background: #1e293b; color: #fff; border-radius: 6px;
  font-size: 12px; font-family: inherit; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  pointer-events: auto; animation: toast-in 0.2s ease-out;
  max-width: 300px; text-align: center;
}
.toast.fade-out { animation: toast-out 0.3s ease-in forwards; }
@keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(-10px); } }

/* Stale snapshot banner */
#stale-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 200;
  background: #f59e0b; color: #1a1d27; padding: 8px 16px;
  font-size: 12px; font-family: inherit; text-align: center;
  display: flex; align-items: center; justify-content: center; gap: 12px;
}
#stale-banner.hidden { display: none; }
#stale-banner button {
  background: none; border: none; color: #1a1d27; cursor: pointer;
  font-size: 16px; font-weight: 700; padding: 0 4px;
}

/* Keyboard shortcut overlay */
#shortcut-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
}
#shortcut-overlay.hidden { display: none; }
.shortcut-panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 24px 32px; max-width: 500px; width: 90%;
}
.shortcut-panel h3 { font-size: 14px; color: var(--accent); margin-bottom: 16px; }
.shortcut-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px;
}
.shortcut-row { display: flex; align-items: center; gap: 12px; }
.shortcut-key {
  display: inline-block; min-width: 28px; padding: 2px 6px; text-align: center;
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
  font-size: 11px; font-weight: 600; color: var(--text);
}
.shortcut-desc { font-size: 11px; color: var(--text-muted); }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
`;
}
