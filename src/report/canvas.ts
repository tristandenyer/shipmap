export function getCanvasScript(): string {
  return `
(function() {
  var canvas = document.getElementById('canvas');
  var container = document.getElementById('canvas-container');
  var svg = document.getElementById('connectors-svg');
  var panel = document.getElementById('detail-panel');
  var panelTitle = document.getElementById('panel-title');
  var panelContent = document.getElementById('panel-content');
  var panelClose = document.getElementById('panel-close');
  var searchInput = document.getElementById('search-input');
  var searchClear = document.getElementById('search-clear');
  var searchCount = document.getElementById('search-count');
  var toastContainer = document.getElementById('toast-container');
  var shortcutOverlay = document.getElementById('shortcut-overlay');
  var staleBanner = document.getElementById('stale-banner');

  // State
  var scale = 1;
  var offsetX = 40;
  var offsetY = 40;
  var isDraggingCanvas = false;
  var isDraggingNode = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragNode = null;
  var dragNodeStartX = 0;
  var dragNodeStartY = 0;
  var selectedNodeId = null;
  var focusedNodeId = null;
  var searchQuery = '';
  var activeFilterType = 'all';
  var activeFilterStatus = 'all';
  var activeFilterRendering = 'all';

  // Node positions (mutable)
  var nodePositions = new Map();
  var collapsedGroups = new Set();

  // Build diff lookup maps
  var diffAddedPaths = new Set();
  var diffRemovedPaths = new Set();
  var diffChangedPaths = new Map();
  var diffAddedConnKeys = new Set();
  var diffRemovedConnKeys = new Set();

  if (DIFF) {
    for (var i = 0; i < DIFF.added.length; i++) {
      var n = DIFF.added[i];
      diffAddedPaths.add(n.path || n.name || n.filePath);
    }
    for (var i = 0; i < DIFF.removed.length; i++) {
      var n = DIFF.removed[i];
      diffRemovedPaths.add(n.path || n.name || n.filePath);
    }
    for (var i = 0; i < DIFF.changed.length; i++) {
      var c = DIFF.changed[i];
      var key = c.node.path || c.node.name || c.node.filePath;
      diffChangedPaths.set(key, c.changes);
    }
    if (DIFF.addedConnectors) {
      for (var i = 0; i < DIFF.addedConnectors.length; i++) {
        diffAddedConnKeys.add(DIFF.addedConnectors[i].source + '→' + DIFF.addedConnectors[i].target);
      }
    }
    if (DIFF.removedConnectors) {
      for (var i = 0; i < DIFF.removedConnectors.length; i++) {
        diffRemovedConnKeys.add(DIFF.removedConnectors[i].source + '→' + DIFF.removedConnectors[i].target);
      }
    }
  }

  // Visible (filtered) node list
  function getVisibleNodes() {
    var nodes = [];
    for (var i = 0; i < REPORT.nodes.length; i++) {
      var node = REPORT.nodes[i];
      if (isNodeVisible(node)) nodes.push(node);
    }
    // Include ghost nodes from diff
    if (DIFF) {
      for (var i = 0; i < DIFF.removed.length; i++) {
        nodes.push(DIFF.removed[i]);
      }
    }
    return nodes;
  }

  function getNodeKey(node) {
    return node.path || node.name || node.filePath || '';
  }

  function isNodeVisible(node) {
    // Type filter
    if (activeFilterType !== 'all' && node.type !== activeFilterType) return false;
    // Status filter (probe mode)
    if (activeFilterStatus !== 'all') {
      var probe = node.probe;
      if (!probe) return false;
      if (probe.status !== activeFilterStatus) return false;
    }
    // Rendering filter
    if (activeFilterRendering !== 'all') {
      if (!node.rendering || node.rendering !== activeFilterRendering) return false;
    }
    return true;
  }

  function matchesSearch(node) {
    if (!searchQuery) return true;
    var q = searchQuery.toLowerCase();
    var fields = [node.path, node.label, node.filePath, node.name].filter(Boolean);
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].toLowerCase().indexOf(q) !== -1) return true;
    }
    return false;
  }

  // ─── Layout ───
  function layoutNodes() {
    var nodes = REPORT.nodes;
    var groups = REPORT.groups;

    var groupOrder = Object.keys(groups).sort(function(a, b) {
      if (a === 'middleware') return -1;
      if (b === 'middleware') return 1;
      if (a === 'external') return 1;
      if (b === 'external') return -1;
      if (a === 'root') return -1;
      if (b === 'root') return 1;
      return a.localeCompare(b);
    });

    var NODE_W = 260;
    var NODE_H = 60;
    var GAP_X = 40;
    var GAP_Y = 20;
    var GROUP_PAD = 30;
    var GROUP_GAP = 60;

    var cursorX = 40;

    for (var gi = 0; gi < groupOrder.length; gi++) {
      var groupName = groupOrder[gi];
      var nodeIds = groups[groupName];
      if (!nodeIds || nodeIds.length === 0) continue;

      var groupNodes = nodeIds.map(function(id) { return nodes.find(function(n) { return n.id === id; }); }).filter(Boolean);
      var cols = Math.ceil(Math.sqrt(groupNodes.length));

      groupNodes.forEach(function(node, i) {
        var col = i % cols;
        var row = Math.floor(i / cols);
        nodePositions.set(node.id, {
          x: cursorX + GROUP_PAD + col * (NODE_W + GAP_X),
          y: GROUP_PAD + row * (NODE_H + GAP_Y),
          w: NODE_W,
          h: NODE_H,
        });
      });

      cursorX += GROUP_PAD * 2 + cols * (NODE_W + GAP_X) + GROUP_GAP;
    }

    // Position ghost/removed nodes from diff
    if (DIFF) {
      for (var i = 0; i < DIFF.removed.length; i++) {
        var rn = DIFF.removed[i];
        if (!nodePositions.has(rn.id)) {
          nodePositions.set(rn.id, { x: cursorX, y: GROUP_PAD + i * (NODE_H + GAP_Y), w: NODE_W, h: NODE_H });
        }
      }
    }
  }

  // ─── Render ───
  function renderNodes() {
    canvas.innerHTML = '';

    // Draw group boxes
    var groups = REPORT.groups;
    for (var groupName in groups) {
      var nodeIds = groups[groupName];
      if (!nodeIds.length) continue;
      var isCollapsed = collapsedGroups.has(groupName);
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var ni = 0; ni < nodeIds.length; ni++) {
        var pos = nodePositions.get(nodeIds[ni]);
        if (!pos) continue;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + pos.w);
        maxY = Math.max(maxY, pos.y + pos.h);
      }
      if (minX === Infinity) continue;

      var pad = 16;
      var box = document.createElement('div');
      box.className = 'group-box' + (isCollapsed ? ' collapsed' : '');
      box.style.left = (minX - pad) + 'px';
      box.style.top = (minY - pad) + 'px';
      box.style.width = (maxX - minX + pad * 2) + 'px';
      box.style.height = isCollapsed ? '32px' : (maxY - minY + pad * 2) + 'px';
      canvas.appendChild(box);

      // Count visible in group
      var visibleInGroup = 0;
      for (var ni = 0; ni < nodeIds.length; ni++) {
        var gn = REPORT.nodes.find(function(n) { return n.id === nodeIds[ni]; });
        if (gn && isNodeVisible(gn) && matchesSearch(gn)) visibleInGroup++;
      }

      var label = document.createElement('div');
      label.className = 'group-label' + (isCollapsed ? ' collapsed' : '');
      label.dataset.group = groupName;
      label.innerHTML = '<span class="collapse-icon">&#9660;</span> ' +
        escapeHtml(groupName === 'root' ? '/' : '/' + groupName) +
        ' <span class="group-count">' + (searchQuery || activeFilterType !== 'all' || activeFilterStatus !== 'all' || activeFilterRendering !== 'all' ? visibleInGroup + ' of ' + nodeIds.length : nodeIds.length) + '</span>';
      label.style.left = (minX - pad) + 'px';
      label.style.top = (minY - pad - 22) + 'px';
      label.addEventListener('click', function(gn) { return function() { toggleGroup(gn); }; }(groupName));
      canvas.appendChild(label);
    }

    // Collect all nodes to render (including ghost/removed)
    var allNodes = REPORT.nodes.slice();
    if (DIFF) {
      for (var i = 0; i < DIFF.removed.length; i++) {
        allNodes.push(DIFF.removed[i]);
      }
    }

    // Draw nodes
    for (var ni = 0; ni < allNodes.length; ni++) {
      var node = allNodes[ni];
      var pos = nodePositions.get(node.id);
      if (!pos) continue;

      if (isNodeInCollapsedGroup(node.id)) continue;

      var nodeKey = getNodeKey(node);
      var isGhost = diffRemovedPaths.has(nodeKey);
      var isAdded = diffAddedPaths.has(nodeKey);
      var isChanged = diffChangedPaths.has(nodeKey);
      var isVisible = isGhost || isNodeVisible(node);
      var matchSearch = matchesSearch(node);

      var el = document.createElement('div');
      var classes = 'node';
      if (node.id === selectedNodeId) classes += ' selected';
      if (node.id === focusedNodeId) classes += ' focused';
      if (!isVisible || !matchSearch) classes += ' filtered-out';
      if (isGhost) classes += ' diff-removed';
      if (isAdded) classes += ' diff-added';
      if (isChanged) classes += ' diff-changed';

      // Probe status class
      if (!isGhost) {
        if (node.probe && node.probe.status && node.probe.status !== 'not-probed') {
          classes += ' probe-' + node.probe.status;
        } else if (node.type === 'external' && node.probe) {
          classes += node.probe.reachable ? ' probe-ok' : ' probe-error';
        }
      }

      el.className = classes;
      el.dataset.id = node.id;
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.style.width = pos.w + 'px';

      // Status dot
      var statusDot = '';
      if (!isGhost) {
        if (node.probe && node.probe.status && node.probe.status !== 'not-probed') {
          statusDot = '<span class="node-status ' + node.probe.status + '"></span>';
        } else if (node.type === 'external' && node.probe) {
          statusDot = '<span class="node-status ' + (node.probe.reachable ? 'ok' : 'error') + '"></span>';
        } else if (node.type === 'external') {
          statusDot = '<span class="node-status external"></span>';
        } else if (REPORT.meta.mode === 'static') {
          statusDot = '<span class="node-status not-probed"></span>';
        }
      }

      var meta = '';
      if (node.type === 'page' && node.rendering) {
        var cls = node.rendering.toLowerCase();
        meta = '<span class="rendering-badge ' + cls + '">' + node.rendering + '</span>';
      }
      if (node.type === 'api' && node.methods) {
        meta = node.methods.map(function(m) { return '<span class="method-badge">' + m + '</span>'; }).join(' ');
      }
      if (node.type === 'middleware') {
        meta = '<span class="rendering-badge edge">edge</span>';
        if (node.authProvider) meta += ' <span style="font-size:10px;color:#f59e0b">' + node.authProvider + '</span>';
      }
      if (node.type === 'external') {
        meta = '<span style="font-size:10px;color:#a855f7">' + node.detectedFrom + '</span>';
        if (node.probe) {
          meta += node.probe.reachable
            ? ' <span class="probe-badge ok">reachable</span>'
            : ' <span class="probe-badge error">unreachable</span>';
          if (node.probe.latency) meta += ' <span class="probe-time">' + node.probe.latency + 'ms</span>';
        }
      }

      var probeMeta = '';
      if (node.probe && node.probe.httpStatus) {
        probeMeta = '<span class="probe-badge ' + node.probe.status + '">' + node.probe.httpStatus + '</span>';
        if (node.probe.responseTime !== undefined) {
          probeMeta += ' <span class="probe-time">' + node.probe.responseTime + 'ms</span>';
        }
      }

      // Snytch badge
      var snytchBadge = '';
      if (node.snytchFindings && node.snytchFindings.length > 0) {
        var maxSev = 'low';
        var sevOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        for (var si = 0; si < node.snytchFindings.length; si++) {
          if ((sevOrder[node.snytchFindings[si].severity] || 0) > (sevOrder[maxSev] || 0)) {
            maxSev = node.snytchFindings[si].severity;
          }
        }
        snytchBadge = '<span class="snytch-badge ' + maxSev + '" title="' + node.snytchFindings.length + ' secret(s) found">' + node.snytchFindings.length + ' secret' + (node.snytchFindings.length > 1 ? 's' : '') + '</span>';
      }

      // Diff badge
      var diffBadge = '';
      if (isAdded) diffBadge = '<span class="diff-badge new">NEW</span>';
      if (isChanged) diffBadge = '<span class="diff-badge changed">&#9650;</span>';

      // Node action buttons (copy, open in browser)
      var actions = '';
      if (!isGhost) {
        actions = '<div class="node-actions">';
        if (node.path) {
          actions += '<button class="node-action-btn" data-action="copy" data-path="' + escapeHtml(node.path) + '" title="Copy path"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v6A1.5 1.5 0 003 10.5h2.5"/></svg></button>';
        }
        if (REPORT.meta.mode === 'probe' && (node.type === 'page' || node.type === 'api') && node.path) {
          actions += '<button class="node-action-btn" data-action="open" data-path="' + escapeHtml(node.path) + '" title="Open in browser">&#8599;</button>';
        }
        actions += '</div>';
      }

      el.innerHTML =
        diffBadge + snytchBadge + actions +
        '<div class="node-header">' +
          statusDot +
          '<span class="node-type ' + node.type + '">' + node.type + '</span>' +
          '<span class="node-label">' + escapeHtml(node.label) + '</span>' +
        '</div>' +
        (meta ? '<div class="node-meta">' + meta + '</div>' : '') +
        (probeMeta ? '<div class="node-meta">' + probeMeta + '</div>' : '');

      if (!isGhost) {
        el.addEventListener('mousedown', onNodeMouseDown);
        el.addEventListener('click', onNodeClick);
      }

      // Action button events
      var actionBtns = el.querySelectorAll('.node-action-btn');
      for (var bi = 0; bi < actionBtns.length; bi++) {
        actionBtns[bi].addEventListener('click', onActionClick);
      }

      canvas.appendChild(el);
      pos.h = Math.max(pos.h, el.offsetHeight);
    }

    drawConnectors();
  }

  // ─── Action button clicks ───
  function onActionClick(e) {
    e.stopPropagation();
    var action = e.currentTarget.dataset.action;
    var path = e.currentTarget.dataset.path;
    if (action === 'copy' && path) {
      copyToClipboard(path);
      showToast('Copied: ' + path);
    }
    if (action === 'open' && path) {
      var baseUrl = REPORT.meta.probeUrl || 'http://localhost:3000';
      window.open(baseUrl + path, '_blank');
    }
  }

  // ─── Connectors ───
  function drawConnectors() {
    svg.innerHTML = '';
    var svgNS = 'http://www.w3.org/2000/svg';

    // Current connectors
    for (var ci = 0; ci < REPORT.connectors.length; ci++) {
      var conn = REPORT.connectors[ci];
      drawSingleConnector(conn, svgNS, false);
    }

    // Removed connectors from diff (ghost connectors)
    if (DIFF && DIFF.removedConnectors) {
      for (var ci = 0; ci < DIFF.removedConnectors.length; ci++) {
        drawSingleConnector(DIFF.removedConnectors[ci], svgNS, true);
      }
    }
  }

  function drawSingleConnector(conn, svgNS, isRemoved) {
    var src = nodePositions.get(conn.source);
    var tgt = nodePositions.get(conn.target);
    if (!src || !tgt) return;

    if (isNodeInCollapsedGroup(conn.source) || isNodeInCollapsedGroup(conn.target)) return;

    var x1 = (src.x + src.w) * scale + offsetX;
    var y1 = (src.y + src.h / 2) * scale + offsetY;
    var x2 = tgt.x * scale + offsetX;
    var y2 = (tgt.y + tgt.h / 2) * scale + offsetY;

    var dx = Math.abs(x2 - x1) * 0.5;
    var d = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2;

    var connKey = conn.source + '\\u2192' + conn.target;
    var isAddedConn = diffAddedConnKeys.has(connKey);
    var isRemovedConn = isRemoved || diffRemovedConnKeys.has(connKey);

    // Check if connected nodes are filtered
    var srcNode = REPORT.nodes.find(function(n) { return n.id === conn.source; });
    var tgtNode = REPORT.nodes.find(function(n) { return n.id === conn.target; });
    var srcVisible = srcNode && isNodeVisible(srcNode) && matchesSearch(srcNode);
    var tgtVisible = tgtNode && isNodeVisible(tgtNode) && matchesSearch(tgtNode);

    var g = document.createElementNS(svgNS, 'g');

    var hitArea = document.createElementNS(svgNS, 'path');
    hitArea.setAttribute('d', d);
    hitArea.setAttribute('fill', 'none');
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('stroke-width', '12');
    hitArea.setAttribute('style', 'pointer-events: stroke;');
    g.appendChild(hitArea);

    var pathClasses = 'connector-path ' + (conn.color || 'grey') + (conn.style === 'dashed' ? ' dashed' : '');
    if (isAddedConn) pathClasses += ' diff-added';
    if (isRemovedConn) pathClasses += ' diff-removed';
    if (!srcVisible || !tgtVisible) pathClasses += ' filtered-out';

    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', pathClasses);
    g.appendChild(path);

    var confidenceLabel = conn.confidence === 'probed' ? 'Confirmed via probe' :
                          conn.confidence === 'static' ? 'Detected via static analysis' :
                          'Inferred relationship';
    if (conn.label) confidenceLabel += ' \\u2014 ' + conn.label;
    var titleEl = document.createElementNS(svgNS, 'title');
    titleEl.textContent = confidenceLabel;
    g.appendChild(titleEl);

    svg.appendChild(g);
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
      var pos = nodePositions.get(dragNode.dataset.id);
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
    var delta = e.deltaY > 0 ? 0.9 : 1.1;
    var newScale = Math.min(3, Math.max(0.1, scale * delta));
    var rect = container.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
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
    var pos = nodePositions.get(dragNode.dataset.id);
    if (pos) {
      dragNodeStartX = pos.x;
      dragNodeStartY = pos.y;
    }
  }

  // ─── Node Click / Detail Panel ───
  function onNodeClick(e) {
    if (isDraggingNode && (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3)) return;
    var id = e.currentTarget.dataset.id;
    selectAndShowNode(id);
  }

  function selectAndShowNode(id) {
    if (selectedNodeId === id) {
      selectedNodeId = null;
      focusedNodeId = null;
      panel.classList.add('hidden');
      renderNodes();
      return;
    }
    selectedNodeId = id;
    focusedNodeId = id;
    var node = REPORT.nodes.find(function(n) { return n.id === id; });
    if (!node) {
      // Check ghost nodes
      if (DIFF) {
        node = DIFF.removed.find(function(n) { return n.id === id; });
      }
      if (!node) return;
    }

    panelTitle.textContent = node.label;
    var html = '';

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

    // Probe results
    if (node.probe) {
      if (node.probe.httpStatus !== undefined) {
        html += field('HTTP Status', node.probe.httpStatus);
      }
      if (node.probe.responseTime !== undefined) {
        html += field('Response Time', node.probe.responseTime + 'ms');
      }
      if (node.probe.status) {
        html += field('Probe Status', node.probe.status);
      }
      if (node.probe.reachable !== undefined) {
        html += field('Host', node.probe.reachable ? 'Reachable' : 'Unreachable');
        if (node.probe.latency) html += field('Latency', node.probe.latency + 'ms');
      }
      if (node.probe.probedAt) {
        html += field('Last Probed', new Date(node.probe.probedAt).toLocaleString());
      }
      if (node.probe.methodResults) {
        html += '<div class="field"><div class="field-label">Method Results</div>';
        for (var method in node.probe.methodResults) {
          var mr = node.probe.methodResults[method];
          var statusCls = mr.httpStatus >= 400 ? 'status-error' : mr.httpStatus === 0 ? 'status-error' : 'status-ok';
          if (mr.responseTime > 2000) statusCls = 'status-slow';
          html += '<div class="method-result">' +
            '<span class="method">' + method + '</span>' +
            '<span class="' + statusCls + '">' + (mr.httpStatus || 'TIMEOUT') + '</span>' +
            '<span class="time">' + mr.responseTime + 'ms</span>' +
          '</div>';
        }
        html += '</div>';
      }
    }

    // Snytch findings
    if (node.snytchFindings && node.snytchFindings.length > 0) {
      html += '<div class="snytch-findings"><div class="field-label">Secret Findings</div>';
      for (var si = 0; si < node.snytchFindings.length; si++) {
        var sf = node.snytchFindings[si];
        html += '<div class="snytch-finding-item ' + sf.severity + '">' +
          '<span class="snytch-severity">' + sf.severity.toUpperCase() + '</span> ' +
          '<span class="snytch-type">' + escapeHtml(sf.secretType) + '</span>' +
          (sf.line ? ' <span class="snytch-line">line ' + sf.line + '</span>' : '') +
          (sf.message ? '<div class="snytch-message">' + escapeHtml(sf.message) + '</div>' : '') +
        '</div>';
      }
      html += '</div>';
    }

    // Diff changes
    var nodeKey = getNodeKey(node);
    if (diffChangedPaths.has(nodeKey)) {
      var changes = diffChangedPaths.get(nodeKey);
      html += '<div class="diff-changes"><div class="diff-changes-title">Changes since last run</div>';
      for (var ci = 0; ci < changes.length; ci++) {
        html += '<div class="diff-change-item">' + escapeHtml(changes[ci]) + '</div>';
      }
      html += '</div>';
    }

    // Show connections
    var outgoing = REPORT.connectors.filter(function(c) { return c.source === id; });
    var incoming = REPORT.connectors.filter(function(c) { return c.target === id; });
    if (outgoing.length > 0) {
      html += '<div class="field"><div class="field-label">Connects To</div><ul class="connector-list">';
      for (var oi = 0; oi < outgoing.length; oi++) {
        var c = outgoing[oi];
        var target = REPORT.nodes.find(function(n) { return n.id === c.target; });
        html += '<li>\\u2192 ' + escapeHtml(target ? target.label : c.target) + (c.label ? ' (' + escapeHtml(c.label) + ')' : '') + '</li>';
      }
      html += '</ul></div>';
    }
    if (incoming.length > 0) {
      html += '<div class="field"><div class="field-label">Connected From</div><ul class="connector-list">';
      for (var ii = 0; ii < incoming.length; ii++) {
        var c = incoming[ii];
        var source = REPORT.nodes.find(function(n) { return n.id === c.source; });
        html += '<li>\\u2190 ' + escapeHtml(source ? source.label : c.source) + (c.label ? ' (' + escapeHtml(c.label) + ')' : '') + '</li>';
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

  // ─── Search ───
  searchInput.addEventListener('input', function() {
    searchQuery = searchInput.value;
    searchClear.className = 'search-clear' + (searchQuery ? ' visible' : '');
    updateSearchCount();
    renderNodes();
  });

  searchClear.addEventListener('click', function() {
    searchInput.value = '';
    searchQuery = '';
    searchClear.className = 'search-clear';
    searchCount.textContent = '';
    renderNodes();
  });

  function updateSearchCount() {
    if (!searchQuery) { searchCount.textContent = ''; return; }
    var total = REPORT.nodes.length;
    var matched = 0;
    for (var i = 0; i < REPORT.nodes.length; i++) {
      if (matchesSearch(REPORT.nodes[i]) && isNodeVisible(REPORT.nodes[i])) matched++;
    }
    searchCount.textContent = matched + ' of ' + total + ' routes';
  }

  // ─── Filters ───
  var filterBtns = document.querySelectorAll('.filter-btn');
  for (var fi = 0; fi < filterBtns.length; fi++) {
    filterBtns[fi].addEventListener('click', onFilterClick);
  }

  function onFilterClick(e) {
    var btn = e.currentTarget;
    if (btn.dataset.filterType !== undefined) {
      activeFilterType = btn.dataset.filterType;
      updateFilterGroup('filterType');
    } else if (btn.dataset.filterStatus !== undefined) {
      activeFilterStatus = btn.dataset.filterStatus;
      updateFilterGroup('filterStatus');
    } else if (btn.dataset.filterRendering !== undefined) {
      activeFilterRendering = btn.dataset.filterRendering;
      updateFilterGroup('filterRendering');
    }
    updateSearchCount();
    updateHashState();
    renderNodes();
  }

  function updateFilterGroup(attr) {
    var btns = document.querySelectorAll('[data-' + attr.replace(/([A-Z])/g, '-$1').toLowerCase() + ']');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.remove('active');
      var val = btns[i].dataset[attr];
      if (attr === 'filterType' && val === activeFilterType) btns[i].classList.add('active');
      if (attr === 'filterStatus' && val === activeFilterStatus) btns[i].classList.add('active');
      if (attr === 'filterRendering' && val === activeFilterRendering) btns[i].classList.add('active');
    }
  }

  // ─── URL Hash State ───
  function updateHashState() {
    var parts = [];
    if (activeFilterType !== 'all') parts.push('type:' + activeFilterType);
    if (activeFilterStatus !== 'all') parts.push('status:' + activeFilterStatus);
    if (activeFilterRendering !== 'all') parts.push('rendering:' + activeFilterRendering);
    window.location.hash = parts.length > 0 ? 'filter=' + parts.join(',') : '';
  }

  function loadHashState() {
    var hash = window.location.hash.replace('#', '');
    if (!hash.startsWith('filter=')) return;
    var filters = hash.replace('filter=', '').split(',');
    for (var i = 0; i < filters.length; i++) {
      var parts = filters[i].split(':');
      if (parts[0] === 'type') activeFilterType = parts[1];
      if (parts[0] === 'status') activeFilterStatus = parts[1];
      if (parts[0] === 'rendering') activeFilterRendering = parts[1];
    }
    updateFilterGroup('filterType');
    updateFilterGroup('filterStatus');
    updateFilterGroup('filterRendering');
  }

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
  document.getElementById('btn-shortcuts').addEventListener('click', function() {
    toggleShortcutOverlay();
  });
  document.getElementById('btn-copy-md').addEventListener('click', function() {
    copyMarkdownToClipboard();
  });

  // ─── Keyboard Shortcuts ───
  window.addEventListener('keydown', function(e) {
    // Don't capture when typing in search
    if (document.activeElement === searchInput) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchQuery = '';
        searchClear.className = 'search-clear';
        searchCount.textContent = '';
        searchInput.blur();
        renderNodes();
      }
      return;
    }

    // Shortcut overlay toggle
    if (e.key === '?') {
      e.preventDefault();
      toggleShortcutOverlay();
      return;
    }

    // Close overlay if open
    if (!shortcutOverlay.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        shortcutOverlay.classList.add('hidden');
      }
      return;
    }

    switch(e.key) {
      case 'f':
      case 'F':
        fitToView();
        break;
      case 'Escape':
        if (!panel.classList.contains('hidden')) {
          selectedNodeId = null;
          panel.classList.add('hidden');
          renderNodes();
        } else if (focusedNodeId) {
          focusedNodeId = null;
          renderNodes();
        }
        break;
      case '/':
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateNodes(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateNodes(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigateGroups(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateGroups(1);
        break;
      case 'Enter':
        if (focusedNodeId) {
          selectAndShowNode(focusedNodeId);
        }
        break;
      case 'c':
      case 'C':
        if (focusedNodeId) {
          var fn = REPORT.nodes.find(function(n) { return n.id === focusedNodeId; });
          if (fn && fn.path) {
            copyToClipboard(fn.path);
            showToast('Copied: ' + fn.path);
          }
        }
        break;
      case 'o':
      case 'O':
        if (focusedNodeId) {
          if (REPORT.meta.mode !== 'probe') {
            showToast('Open in browser requires --probe mode');
          } else {
            var on = REPORT.nodes.find(function(n) { return n.id === focusedNodeId; });
            if (on && on.path) {
              var baseUrl = REPORT.meta.probeUrl || 'http://localhost:3000';
              window.open(baseUrl + on.path, '_blank');
            }
          }
        }
        break;
      case 'g':
      case 'G':
        if (focusedNodeId) {
          for (var gn in REPORT.groups) {
            if (REPORT.groups[gn].indexOf(focusedNodeId) !== -1) {
              toggleGroup(gn);
              break;
            }
          }
        }
        break;
      case '1':
        setFilterType('all');
        break;
      case '2':
        setFilterType('page');
        break;
      case '3':
        setFilterType('api');
        break;
      case '4':
        activeFilterStatus = 'error';
        updateFilterGroup('filterStatus');
        updateHashState();
        renderNodes();
        break;
      case '+':
      case '=':
        scale = Math.min(3, scale * 1.1);
        applyTransform();
        break;
      case '-':
        scale = Math.max(0.1, scale * 0.9);
        applyTransform();
        break;
    }
  });

  function setFilterType(type) {
    activeFilterType = type;
    if (type === 'all') {
      activeFilterStatus = 'all';
      activeFilterRendering = 'all';
      updateFilterGroup('filterStatus');
      updateFilterGroup('filterRendering');
    }
    updateFilterGroup('filterType');
    updateHashState();
    renderNodes();
  }

  // ─── Node Navigation ───
  function navigateNodes(direction) {
    var visible = getVisibleNodes().filter(function(n) { return matchesSearch(n) && !isNodeInCollapsedGroup(n.id); });
    if (visible.length === 0) return;

    if (!focusedNodeId) {
      focusedNodeId = visible[0].id;
    } else {
      var idx = visible.findIndex(function(n) { return n.id === focusedNodeId; });
      if (idx === -1) idx = 0;
      else idx = (idx + direction + visible.length) % visible.length;
      focusedNodeId = visible[idx].id;
    }
    scrollToNode(focusedNodeId);
    renderNodes();
  }

  function navigateGroups(direction) {
    var groupOrder = Object.keys(REPORT.groups);
    if (groupOrder.length === 0) return;

    var currentGroup = null;
    if (focusedNodeId) {
      for (var g in REPORT.groups) {
        if (REPORT.groups[g].indexOf(focusedNodeId) !== -1) { currentGroup = g; break; }
      }
    }

    var idx = currentGroup ? groupOrder.indexOf(currentGroup) : -1;
    idx = (idx + direction + groupOrder.length) % groupOrder.length;
    var nextGroup = groupOrder[idx];
    var groupNodes = REPORT.groups[nextGroup];
    if (groupNodes && groupNodes.length > 0) {
      focusedNodeId = groupNodes[0];
      scrollToNode(focusedNodeId);
      renderNodes();
    }
  }

  function scrollToNode(nodeId) {
    var pos = nodePositions.get(nodeId);
    if (!pos) return;
    var rect = container.getBoundingClientRect();
    var nodeScreenX = pos.x * scale + offsetX;
    var nodeScreenY = pos.y * scale + offsetY;
    if (nodeScreenX < 0 || nodeScreenX > rect.width || nodeScreenY < 0 || nodeScreenY > rect.height) {
      offsetX = rect.width / 2 - pos.x * scale;
      offsetY = rect.height / 2 - pos.y * scale;
      applyTransform();
    }
  }

  // ─── Shortcut Overlay ───
  function toggleShortcutOverlay() {
    shortcutOverlay.classList.toggle('hidden');
  }
  shortcutOverlay.addEventListener('click', function(e) {
    if (e.target === shortcutOverlay) shortcutOverlay.classList.add('hidden');
  });

  // ─── Toast System ───
  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Max 3 visible
    while (toastContainer.children.length > 3) {
      toastContainer.removeChild(toastContainer.firstChild);
    }

    setTimeout(function() {
      toast.classList.add('fade-out');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2000);
  }

  // ─── Clipboard ───
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // ─── Copy Markdown ───
  function copyMarkdownToClipboard() {
    var lines = [];
    lines.push('# shipmap \\u2014 ' + REPORT.meta.projectName);
    lines.push('> Generated: ' + REPORT.meta.generatedAt + ' | Framework: ' + REPORT.meta.framework + (REPORT.meta.frameworkVersion ? ' ' + REPORT.meta.frameworkVersion : '') + ' | Mode: ' + (REPORT.meta.mode === 'probe' ? 'Probe' : 'Static'));
    lines.push('');

    var pages = REPORT.nodes.filter(function(n) { return n.type === 'page'; });
    var apis = REPORT.nodes.filter(function(n) { return n.type === 'api'; });
    var middleware = REPORT.nodes.filter(function(n) { return n.type === 'middleware'; });
    var externals = REPORT.nodes.filter(function(n) { return n.type === 'external'; });

    if (pages.length > 0) {
      lines.push('## Pages (' + pages.length + ')');
      if (REPORT.meta.mode === 'probe') {
        lines.push('| Route | Rendering | Status | Response Time | Auth |');
        lines.push('|-------|-----------|--------|---------------|------|');
        for (var i = 0; i < pages.length; i++) {
          var p = pages[i];
          var status = p.probe && p.probe.httpStatus ? p.probe.httpStatus + (p.probe.httpStatus < 400 ? ' \\u2713' : ' \\u2717') : '\\u2014';
          var time = p.probe && p.probe.responseTime !== undefined ? p.probe.responseTime + 'ms' : '\\u2014';
          lines.push('| \\x60' + p.path + '\\x60 | ' + (p.rendering || '\\u2014') + ' | ' + status + ' | ' + time + ' | ' + (p.isProtected ? 'Protected' : 'Public') + ' |');
        }
      } else {
        lines.push('| Route | Rendering | Auth |');
        lines.push('|-------|-----------|------|');
        for (var i = 0; i < pages.length; i++) {
          var p = pages[i];
          lines.push('| \\x60' + p.path + '\\x60 | ' + (p.rendering || '\\u2014') + ' | ' + (p.isProtected ? 'Protected' : 'Public') + ' |');
        }
      }
      lines.push('');
    }

    if (apis.length > 0) {
      lines.push('## API Routes (' + apis.length + ')');
      lines.push('| Route | Methods | Auth |');
      lines.push('|-------|---------|------|');
      for (var i = 0; i < apis.length; i++) {
        var a = apis[i];
        lines.push('| \\x60' + a.path + '\\x60 | ' + (a.methods ? a.methods.join(', ') : '\\u2014') + ' | ' + (a.isProtected ? 'Protected' : 'Public') + ' |');
      }
      lines.push('');
    }

    if (middleware.length > 0) {
      lines.push('## Middleware (' + middleware.length + ')');
      lines.push('| File | Matches | Auth Provider | Runtime |');
      lines.push('|------|---------|---------------|---------|');
      for (var i = 0; i < middleware.length; i++) {
        var mw = middleware[i];
        lines.push('| \\x60' + mw.filePath + '\\x60 | ' + (mw.matcherPatterns && mw.matcherPatterns.length > 0 ? mw.matcherPatterns.join(', ') : 'all routes') + ' | ' + (mw.authProvider || '\\u2014') + ' | ' + mw.runtime + ' |');
      }
      lines.push('');
    }

    if (externals.length > 0) {
      lines.push('## External Services (' + externals.length + ')');
      lines.push('| Service | Detected From | Used By |');
      lines.push('|---------|--------------|---------|');
      for (var i = 0; i < externals.length; i++) {
        var ext = externals[i];
        lines.push('| ' + ext.name + ' | ' + ext.detectedFrom + ' | ' + ext.referencedBy.length + ' routes |');
      }
      lines.push('');
    }

    var md = lines.join('\\n');
    copyToClipboard(md);
    showToast('Copied topology as Markdown');
  }

  // ─── Stale Snapshot Warning ───
  function checkStaleSnapshot() {
    if (sessionStorage.getItem('shipmap-stale-dismissed')) return;
    var generatedAt = new Date(REPORT.meta.generatedAt);
    var now = new Date();
    var hoursOld = (now - generatedAt) / (1000 * 60 * 60);

    if (hoursOld > 4) {
      var ageText;
      if (hoursOld > 168) ageText = 'over a week old';
      else if (hoursOld > 24) ageText = Math.floor(hoursOld / 24) + ' days old';
      else ageText = Math.floor(hoursOld) + ' hours old';

      staleBanner.innerHTML = '\\u23f0 This snapshot is ' + ageText + '. Re-run \\'npx shipmap\\' for fresh data. <button id="stale-dismiss">\\u00d7</button>';
      staleBanner.classList.remove('hidden');

      document.getElementById('stale-dismiss').addEventListener('click', function() {
        staleBanner.classList.add('hidden');
        sessionStorage.setItem('shipmap-stale-dismissed', '1');
      });
    }
  }

  function fitToView() {
    if (nodePositions.size === 0) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var pos of nodePositions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.w);
      maxY = Math.max(maxY, pos.y + pos.h);
    }
    var pad = 60;
    var cw = container.clientWidth;
    var ch = container.clientHeight;
    var contentW = maxX - minX + pad * 2;
    var contentH = maxY - minY + pad * 2;
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
    for (var groupName in REPORT.groups) {
      if (collapsedGroups.has(groupName) && REPORT.groups[groupName].indexOf(nodeId) !== -1) return true;
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
  loadHashState();
  layoutNodes();
  renderNodes();
  applyTransform();
  setTimeout(fitToView, 100);
  checkStaleSnapshot();
})();
`;
}
