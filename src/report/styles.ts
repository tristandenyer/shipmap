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

/* Nodes */
.node {
  position: absolute; padding: 10px 14px; border-radius: 8px;
  background: var(--surface); border: 1px solid var(--border);
  cursor: pointer; user-select: none; min-width: 140px;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.node:hover { border-color: var(--accent); box-shadow: 0 0 12px rgba(108,140,255,0.2); }
.node.selected { border-color: var(--accent); box-shadow: 0 0 20px rgba(108,140,255,0.3); }
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

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
`;
}
