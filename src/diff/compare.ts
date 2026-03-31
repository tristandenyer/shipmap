import type { TopologyReport, TopologyNode, ProbeResult, RouteNode, Connector } from '../types.js';

export interface NodeChange {
  node: TopologyNode;
  changes: string[];
  previousProbe?: ProbeResult;
  currentProbe?: ProbeResult;
}

export interface DiffResult {
  added: TopologyNode[];
  removed: TopologyNode[];
  changed: NodeChange[];
  unchanged: TopologyNode[];
  addedConnectors: Connector[];
  removedConnectors: Connector[];
  summary: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
  };
}

function getNodePath(node: TopologyNode): string | null {
  if (node.type === 'page' || node.type === 'api') return node.path;
  if (node.type === 'middleware') return `__middleware__${node.filePath}`;
  if (node.type === 'external') return `__external__${node.name}`;
  return null;
}

export function compareTopology(
  current: TopologyReport,
  previous: TopologyReport,
): DiffResult {
  const prevByPath = new Map<string, TopologyNode>();
  const currByPath = new Map<string, TopologyNode>();

  for (const node of previous.nodes) {
    const p = getNodePath(node);
    if (p) prevByPath.set(p, node);
  }
  for (const node of current.nodes) {
    const p = getNodePath(node);
    if (p) currByPath.set(p, node);
  }

  const added: TopologyNode[] = [];
  const removed: TopologyNode[] = [];
  const changed: NodeChange[] = [];
  const unchanged: TopologyNode[] = [];

  // Find added and changed
  for (const [path, currNode] of currByPath) {
    const prevNode = prevByPath.get(path);
    if (!prevNode) {
      added.push(currNode);
      continue;
    }

    const changes = detectChanges(currNode, prevNode);
    if (changes.length > 0) {
      const change: NodeChange = { node: currNode, changes };
      if (isRouteNode(currNode) && currNode.probe) change.currentProbe = currNode.probe;
      if (isRouteNode(prevNode) && prevNode.probe) change.previousProbe = prevNode.probe;
      changed.push(change);
    } else {
      unchanged.push(currNode);
    }
  }

  // Find removed
  for (const [path, prevNode] of prevByPath) {
    if (!currByPath.has(path)) {
      removed.push(prevNode);
    }
  }

  // Connector diff
  const connKey = (c: Connector) => `${c.source}→${c.target}`;
  const prevConnKeys = new Set(previous.connectors.map(connKey));
  const currConnKeys = new Set(current.connectors.map(connKey));

  const addedConnectors = current.connectors.filter(c => !prevConnKeys.has(connKey(c)));
  const removedConnectors = previous.connectors.filter(c => !currConnKeys.has(connKey(c)));

  return {
    added,
    removed,
    changed,
    unchanged,
    addedConnectors,
    removedConnectors,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      unchangedCount: unchanged.length,
    },
  };
}

function isRouteNode(node: TopologyNode): node is RouteNode {
  return node.type === 'page' || node.type === 'api';
}

function detectChanges(curr: TopologyNode, prev: TopologyNode): string[] {
  const changes: string[] = [];

  if (isRouteNode(curr) && isRouteNode(prev)) {
    // HTTP status change
    if (curr.probe?.httpStatus !== undefined && prev.probe?.httpStatus !== undefined) {
      if (curr.probe.httpStatus !== prev.probe.httpStatus) {
        changes.push(`Status changed: ${prev.probe.httpStatus} → ${curr.probe.httpStatus}`);
      }
    }

    // Response time change (>50%)
    if (curr.probe?.responseTime !== undefined && prev.probe?.responseTime !== undefined) {
      const ratio = prev.probe.responseTime > 0
        ? curr.probe.responseTime / prev.probe.responseTime
        : 0;
      if (ratio > 1.5) {
        changes.push(`Response time increased: ${prev.probe.responseTime}ms → ${curr.probe.responseTime}ms`);
      } else if (ratio < 0.5 && ratio > 0) {
        changes.push(`Response time decreased: ${prev.probe.responseTime}ms → ${curr.probe.responseTime}ms`);
      }
    }

    // Rendering strategy
    if (curr.rendering !== prev.rendering && curr.rendering && prev.rendering) {
      changes.push(`Rendering changed: ${prev.rendering} → ${curr.rendering}`);
    }

    // Methods (API routes)
    if (curr.methods && prev.methods) {
      const added = curr.methods.filter(m => !prev.methods!.includes(m));
      const removed = prev.methods.filter(m => !curr.methods!.includes(m));
      if (added.length > 0) changes.push(`New methods: ${added.join(', ')}`);
      if (removed.length > 0) changes.push(`Removed methods: ${removed.join(', ')}`);
    }

    // Auth status
    if (curr.isProtected !== prev.isProtected) {
      changes.push(curr.isProtected ? 'Now protected by middleware' : 'No longer protected');
    }

    // Middleware coverage
    if (curr.middleware && prev.middleware) {
      const newMw = curr.middleware.filter(m => !prev.middleware!.includes(m));
      if (newMw.length > 0) changes.push(`New middleware: ${newMw.join(', ')}`);
    } else if (curr.middleware && !prev.middleware) {
      changes.push(`Now covered by middleware`);
    }

    // External dependencies
    if (curr.externals && prev.externals) {
      const newExt = curr.externals.filter(e => !prev.externals!.includes(e));
      if (newExt.length > 0) changes.push(`New external dependency: ${newExt.join(', ')}`);
    } else if (curr.externals && !prev.externals) {
      changes.push(`New external dependencies: ${curr.externals.join(', ')}`);
    }
  }

  return changes;
}
