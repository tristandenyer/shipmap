import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { TopologyReport, TopologyNode, Connector } from '../types.js';
import { detectFramework } from '../detect/framework.js';
import { discoverPageRoutes } from './nextjs/routes.js';
import { discoverApiRoutes } from './nextjs/api.js';
import { discoverMiddleware } from './nextjs/middleware.js';
import { discoverExternals } from './nextjs/externals.js';

export async function discover(projectDir: string): Promise<TopologyReport> {
  const framework = await detectFramework(projectDir);

  if (framework.type !== 'nextjs') {
    throw new Error(
      `Framework "${framework.type}" is not yet supported. Phase 1 supports Next.js only.`,
    );
  }

  const projectName = await getProjectName(projectDir);

  // Discover all route types
  const pageRoutes = await discoverPageRoutes(projectDir);
  const apiRoutes = await discoverApiRoutes(projectDir);

  // Build route file map for middleware and externals
  const routeNodeIds = new Map<string, string>();
  const routeFileMap = new Map<string, string>();
  for (const route of [...pageRoutes, ...apiRoutes]) {
    routeNodeIds.set(route.path, route.id);
    routeFileMap.set(route.filePath, route.id);
  }

  // Discover middleware and externals
  const middlewareResult = await discoverMiddleware(projectDir, routeNodeIds);
  const externalsResult = await discoverExternals(projectDir, routeFileMap);

  // Collect all nodes and connectors
  const nodes: TopologyNode[] = [...pageRoutes, ...apiRoutes];
  const connectors: Connector[] = [];

  if (middlewareResult) {
    nodes.push(middlewareResult.node);
    connectors.push(...middlewareResult.connectors);
  }

  nodes.push(...externalsResult.nodes);
  connectors.push(...externalsResult.connectors);

  // Build groups
  const groups: Record<string, string[]> = {};
  for (const node of nodes) {
    const group = node.group;
    if (!groups[group]) groups[group] = [];
    groups[group].push(node.id);
  }

  // Build summary
  const renderingBreakdown: Record<string, number> = {};
  for (const route of pageRoutes) {
    const strategy = route.rendering || 'Unknown';
    renderingBreakdown[strategy] = (renderingBreakdown[strategy] || 0) + 1;
  }

  const protectedRoutes = middlewareResult
    ? middlewareResult.connectors.length
    : 0;

  const report: TopologyReport = {
    meta: {
      tool: 'shipmap',
      version: '0.2.0',
      generatedAt: new Date().toISOString(),
      framework: framework.type,
      frameworkVersion: framework.version,
      projectName,
      mode: 'static',
    },
    nodes,
    connectors,
    groups,
    summary: {
      totalRoutes: pageRoutes.length,
      totalApiRoutes: apiRoutes.length,
      totalMiddleware: middlewareResult ? 1 : 0,
      totalExternals: externalsResult.nodes.length,
      protectedRoutes,
      renderingBreakdown,
    },
  };

  return report;
}

async function getProjectName(projectDir: string): Promise<string> {
  try {
    const raw = await readFile(join(projectDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return pkg.name || basename(projectDir);
  } catch {
    return basename(projectDir);
  }
}
