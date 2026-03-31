export function getCanvasScript(): string {
  return `
(function() {
  const canvas = document.getElementById('canvas');
  const container = document.getElementById('canvas-container');
  const svg = document.getElementById('connectors-svg');
  const panel = document.getElementById('detail-panel');
  const panelTitle = document.getElementById('panel-title');
  const panelContent = document.getElementById('panel-content');
  const panelClose = document.getElementById('panel-close');

  // State
  let scale = 1;
  let offsetX = 40;
  let offsetY = 40;
  let isDraggingCanvas = false;
  let isDraggingNode = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragNode = null;
  let dragNodeStartX = 0;
  let dragNodeStartY = 0;
  let selectedNodeId = null;

  // Node positions (mutable)
  const nodePositions = new Map();
  // Collapsed groups
  const collapsedGroups = new Set();

  // ─── Layout ───
  function layoutNodes() {
    const nodes = REPORT.nodes;
    const groups = REPORT.groups;

    // Sort groups: middleware first, then root, then alphabetical, externals last
    const groupOrder = Object.keys(groups).sort((a, b) => {
      if (a === 'middleware') return -1;
      if (b === 'middleware') return 1;
      if (a === 'external') return 1;
      if (b === 'external') return -1;
      if (a === 'root') return -1;
      if (b === 'root') return 1;
      return a.localeCompare(b);
    });

    const NODE_W = 200;
    const NODE_H = 60;
    const GAP_X = 40;
    const GAP_Y = 20;
    const GROUP_PAD = 30;
    const GROUP_GAP = 60;

    let cursorX = 40;

    for (const groupName of groupOrder) {
      const nodeIds = groups[groupName];
      if (!nodeIds || nodeIds.length === 0) continue;

      const groupNodes = nodeIds.map(id => nodes.find(n => n.id === id)).filter(Boolean);
      const cols = Math.ceil(Math.sqrt(groupNodes.length));
      const rows = Math.ceil(groupNodes.length / cols);

      groupNodes.forEach((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        nodePositions.set(node.id, {
          x: cursorX + GROUP_PAD + col * (NODE_W + GAP_X),
          y: GROUP_PAD + row * (NODE_H + GAP_Y),
          w: NODE_W,
          h: NODE_H,
        });
      });

      cursorX += GROUP_PAD * 2 + cols * (NODE_W + GAP_X) + GROUP_GAP;
    }
  }

  // ─── Render ───
  function renderNodes() {
    canvas.innerHTML = '';

    // Draw group boxes
    const groups = REPORT.groups;
    for (const [groupName, nodeIds] of Object.entries(groups)) {
      if (!nodeIds.length) continue;
      const isCollapsed = collapsedGroups.has(groupName);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const id of nodeIds) {
        const pos = nodePositions.get(id);
        if (!pos) continue;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + pos.w);
        maxY = Math.max(maxY, pos.y + pos.h);
      }
      if (minX === Infinity) continue;

      const pad = 16;
      const box = document.createElement('div');
      box.className = 'group-box' + (isCollapsed ? ' collapsed' : '');
      box.style.left = (minX - pad) + 'px';
      box.style.top = (minY - pad) + 'px';
      box.style.width = (maxX - minX + pad * 2) + 'px';
      box.style.height = isCollapsed ? '32px' : (maxY - minY + pad * 2) + 'px';
      canvas.appendChild(box);

      const label = document.createElement('div');
      label.className = 'group-label' + (isCollapsed ? ' collapsed' : '');
      label.dataset.group = groupName;
      label.innerHTML = '<span class="collapse-icon">▼</span> ' +
        escapeHtml(groupName === 'root' ? '/' : '/' + groupName) +
        ' <span class="group-count">' + nodeIds.length + '</span>';
      label.style.left = (minX - pad) + 'px';
      label.style.top = (minY - pad - 22) + 'px';
      label.addEventListener('click', function() { toggleGroup(groupName); });
      canvas.appendChild(label);
    }

    // Draw nodes
    for (const node of REPORT.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;

      // Skip nodes in collapsed groups
      if (isNodeInCollapsedGroup(node.id)) continue;

      const el = document.createElement('div');
      el.className = 'node' + (node.id === selectedNodeId ? ' selected' : '');
      el.dataset.id = node.id;
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.style.width = pos.w + 'px';

      let meta = '';
      if (node.type === 'page' && node.rendering) {
        const cls = node.rendering.toLowerCase();
        meta = '<span class="rendering-badge ' + cls + '">' + node.rendering + '</span>';
      }
      if (node.type === 'api' && node.methods) {
        meta = node.methods.map(m => '<span class="method-badge">' + m + '</span>').join(' ');
      }
      if (node.type === 'middleware') {
        meta = '<span class="rendering-badge edge">edge</span>';
        if (node.authProvider) meta += ' <span style="font-size:10px;color:#f59e0b">' + node.authProvider + '</span>';
      }
      if (node.type === 'external') {
        meta = '<span style="font-size:10px;color:#a855f7">' + node.detectedFrom + '</span>';
      }

      el.innerHTML =
        '<div class="node-header">' +
          '<span class="node-type ' + node.type + '">' + node.type + '</span>' +
          '<span class="node-label">' + escapeHtml(node.label) + '</span>' +
        '</div>' +
        (meta ? '<div class="node-meta">' + meta + '</div>' : '');

      // Measure height after render
      el.addEventListener('mousedown', onNodeMouseDown);
      el.addEventListener('click', onNodeClick);
      canvas.appendChild(el);

      // Update stored height
      pos.h = Math.max(pos.h, el.offsetHeight);
    }

    drawConnectors();
  }

  // ─── Connectors ───
  function drawConnectors() {
    svg.innerHTML = '';
    const svgNS = 'http://www.w3.org/2000/svg';

    for (const conn of REPORT.connectors) {
      const src = nodePositions.get(conn.source);
      const tgt = nodePositions.get(conn.target);
      if (!src || !tgt) continue;

      // Hide connectors for collapsed group nodes
      if (isNodeInCollapsedGroup(conn.source) || isNodeInCollapsedGroup(conn.target)) continue;

      const x1 = (src.x + src.w) * scale + offsetX;
      const y1 = (src.y + src.h / 2) * scale + offsetY;
      const x2 = tgt.x * scale + offsetX;
      const y2 = (tgt.y + tgt.h / 2) * scale + offsetY;

      const dx = Math.abs(x2 - x1) * 0.5;
      const d = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2;

      // Create a group for the path + invisible hover target + tooltip
      const g = document.createElementNS(svgNS, 'g');

      // Invisible wider path for easier hover
      const hitArea = document.createElementNS(svgNS, 'path');
      hitArea.setAttribute('d', d);
      hitArea.setAttribute('fill', 'none');
      hitArea.setAttribute('stroke', 'transparent');
      hitArea.setAttribute('stroke-width', '12');
      hitArea.setAttribute('style', 'pointer-events: stroke;');
      g.appendChild(hitArea);

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'connector-path ' + (conn.color || 'grey') + (conn.style === 'dashed' ? ' dashed' : ''));
      g.appendChild(path);

      // Tooltip showing confidence
      var confidenceLabel = conn.confidence === 'probed' ? 'Confirmed via probe' :
                            conn.confidence === 'static' ? 'Detected via static analysis' :
                            'Inferred relationship';
      if (conn.label) confidenceLabel += ' — ' + conn.label;
      var titleEl = document.createElementNS(svgNS, 'title');
      titleEl.textContent = confidenceLabel;
      g.appendChild(titleEl);

      svg.appendChild(g);
    }
  }

  // ─── Transform ───
  function applyTransform() {
    canvas.style.transform = 'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scale + ')';
    drawConnectors();
  }

  // ─── Pan & Zoom ───
  container.addEventListener('mousedown', function(e) {
    if (e.target !== container && e.target !== svg) return;
    isDraggingCanvas = true;
    dragStartX = e.clientX - offsetX;
    dragStartY = e.clientY - offsetY;
    container.classList.add('dragging');
  });

  window.addEventListener('mousemove', function(e) {
    if (isDraggingCanvas) {
      offsetX = e.clientX - dragStartX;
      offsetY = e.clientY - dragStartY;
      applyTransform();
    }
    if (isDraggingNode && dragNode) {
      const pos = nodePositions.get(dragNode.dataset.id);
      if (pos) {
        pos.x = dragNodeStartX + (e.clientX - dragStartX) / scale;
        pos.y = dragNodeStartY + (e.clientY - dragStartY) / scale;
        dragNode.style.left = pos.x + 'px';
        dragNode.style.top = pos.y + 'px';
        drawConnectors();
      }
    }
  });

  window.addEventListener('mouseup', function() {
    isDraggingCanvas = false;
    isDraggingNode = false;
    dragNode = null;
    container.classList.remove('dragging');
  });

  container.addEventListener('wheel', function(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.1, scale * delta));
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    offsetX = mx - (mx - offsetX) * (newScale / scale);
    offsetY = my - (my - offsetY) * (newScale / scale);
    scale = newScale;
    applyTransform();
  }, { passive: false });

  // ─── Node Drag ───
  function onNodeMouseDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDraggingNode = true;
    dragNode = e.currentTarget;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const pos = nodePositions.get(dragNode.dataset.id);
    if (pos) {
      dragNodeStartX = pos.x;
      dragNodeStartY = pos.y;
    }
  }

  // ─── Node Click / Detail Panel ───
  function onNodeClick(e) {
    if (isDraggingNode && (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3)) return;
    const id = e.currentTarget.dataset.id;
    if (selectedNodeId === id) {
      selectedNodeId = null;
      panel.classList.add('hidden');
      renderNodes();
      return;
    }
    selectedNodeId = id;
    const node = REPORT.nodes.find(n => n.id === id);
    if (!node) return;

    panelTitle.textContent = node.label;
    let html = '';

    html += field('Type', node.type);
    if (node.filePath) html += field('File', node.filePath);
    if (node.path) html += field('Path', node.path);
    if (node.rendering) html += field('Rendering', node.rendering);
    if (node.methods) html += field('Methods', node.methods.join(', '));
    if (node.matcherPatterns) html += field('Matchers', node.matcherPatterns.join(', '));
    if (node.authProvider) html += field('Auth', node.authProvider);
    if (node.redirectTarget) html += field('Redirect', node.redirectTarget);
    if (node.runtime) html += field('Runtime', node.runtime);
    if (node.detectedFrom) html += field('Detected From', node.detectedFrom);
    if (node.group) html += field('Group', node.group);

    // Show connections
    const outgoing = REPORT.connectors.filter(c => c.source === id);
    const incoming = REPORT.connectors.filter(c => c.target === id);
    if (outgoing.length > 0) {
      html += '<div class="field"><div class="field-label">Connects To</div><ul class="connector-list">';
      for (const c of outgoing) {
        const target = REPORT.nodes.find(n => n.id === c.target);
        html += '<li>→ ' + escapeHtml(target ? target.label : c.target) + (c.label ? ' (' + escapeHtml(c.label) + ')' : '') + '</li>';
      }
      html += '</ul></div>';
    }
    if (incoming.length > 0) {
      html += '<div class="field"><div class="field-label">Connected From</div><ul class="connector-list">';
      for (const c of incoming) {
        const source = REPORT.nodes.find(n => n.id === c.source);
        html += '<li>← ' + escapeHtml(source ? source.label : c.source) + (c.label ? ' (' + escapeHtml(c.label) + ')' : '') + '</li>';
      }
      html += '</ul></div>';
    }

    panelContent.innerHTML = html;
    panel.classList.remove('hidden');
    renderNodes();
  }

  panelClose.addEventListener('click', function() {
    selectedNodeId = null;
    panel.classList.add('hidden');
    renderNodes();
  });

  // ─── Toolbar ───
  document.getElementById('btn-fit').addEventListener('click', fitToView);
  document.getElementById('btn-zoom-in').addEventListener('click', function() {
    scale = Math.min(3, scale * 1.2);
    applyTransform();
  });
  document.getElementById('btn-zoom-out').addEventListener('click', function() {
    scale = Math.max(0.1, scale * 0.8);
    applyTransform();
  });

  // Keyboard
  window.addEventListener('keydown', function(e) {
    if (e.key === 'f' || e.key === 'F') fitToView();
    if (e.key === 'Escape') {
      selectedNodeId = null;
      panel.classList.add('hidden');
      renderNodes();
    }
    if (e.key === '+' || e.key === '=') { scale = Math.min(3, scale * 1.1); applyTransform(); }
    if (e.key === '-') { scale = Math.max(0.1, scale * 0.9); applyTransform(); }
  });

  function fitToView() {
    if (nodePositions.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of nodePositions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.w);
      maxY = Math.max(maxY, pos.y + pos.h);
    }
    const pad = 60;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const contentW = maxX - minX + pad * 2;
    const contentH = maxY - minY + pad * 2;
    scale = Math.min(1.5, Math.min(cw / contentW, ch / contentH));
    offsetX = (cw - contentW * scale) / 2 - minX * scale + pad * scale;
    offsetY = (ch - contentH * scale) / 2 - minY * scale + pad * scale;
    applyTransform();
  }

  // ─── Groups ───
  function toggleGroup(groupName) {
    if (collapsedGroups.has(groupName)) {
      collapsedGroups.delete(groupName);
    } else {
      collapsedGroups.add(groupName);
    }
    renderNodes();
  }

  function isNodeInCollapsedGroup(nodeId) {
    for (const [groupName, nodeIds] of Object.entries(REPORT.groups)) {
      if (collapsedGroups.has(groupName) && nodeIds.indexOf(nodeId) !== -1) return true;
    }
    return false;
  }

  // ─── Helpers ───
  function field(label, value) {
    return '<div class="field"><div class="field-label">' + escapeHtml(label) + '</div><div class="field-value">' + escapeHtml(String(value)) + '</div></div>';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Init ───
  layoutNodes();
  renderNodes();
  applyTransform();
  setTimeout(fitToView, 100);
})();
`;
}
