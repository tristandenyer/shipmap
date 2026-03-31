import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { TopologyReport, TopologyNode, Connector, FrameworkType } from '../types.js';
import type { ExternalServiceConfig } from '../config.js';
import { detectFramework } from '../detect/framework.js';
import type { FrameworkDiscoverer } from './types.js';

async function getDiscoverer(frameworkType: FrameworkType): Promise<FrameworkDiscoverer> {
  switch (frameworkType) {
    case 'nextjs': {
      const mod = await import('./nextjs/discoverer.js');
      return mod.nextjsDiscoverer;
    }
    case 'vite-react': {
      const mod = await import('./vite-react/discoverer.js');
      return mod.viteReactDiscoverer;
    }
    case 'remix': {
      const mod = await import('./remix/discoverer.js');
      return mod.remixDiscoverer;
    }
    case 'sveltekit': {
      const mod = await import('./sveltekit/discoverer.js');
      return mod.sveltekitDiscoverer;
    }
    case 'astro': {
      const mod = await import('./astro/discoverer.js');
      return mod.astroDiscoverer;
    }
    case 'nuxt': {
      const mod = await import('./nuxt/discoverer.js');
      return mod.nuxtDiscoverer;
    }
    case 'react-router-spa': {
      const mod = await import('./react-router-spa/discoverer.js');
      return mod.reactRouterSpaDiscoverer;
    }
    case 'generic': {
      const mod = await import('./generic/discoverer.js');
      return mod.genericDiscoverer;
    }
  }
}

export async function discover(
  projectDir: string,
  options?: { customExternals?: ExternalServiceConfig[] },
): Promise<TopologyReport> {
  const framework = await detectFramework(projectDir);
  const discoverer = await getDiscoverer(framework.type);
  const projectName = await getProjectName(projectDir);

  // Discover all route types
  const pageRoutes = await discoverer.discoverRoutes(projectDir);
  const apiRoutes = await discoverer.discoverApiRoutes(projectDir);

  // Build route file map for middleware and externals
  const routeNodeIds = new Map<string, string>();
  const routeFileMap = new Map<string, string>();
  for (const route of [...pageRoutes, ...apiRoutes]) {
    routeNodeIds.set(route.path, route.id);
    routeFileMap.set(route.filePath, route.id);
  }

  // Discover middleware and externals
  const middlewareResult = await discoverer.discoverMiddleware(projectDir, routeNodeIds);

  // Build extra patterns from config
  const extraPatterns = options?.customExternals?.map((ext) => ({
    name: ext.name,
    envPrefixes: ext.envPrefixes || [],
    importPatterns: ext.importPatterns || [],
  }));

  // All discoverers delegate to the shared externals module
  const { discoverExternals } = await import('./nextjs/externals.js');
  const externalsResult = await discoverExternals(projectDir, routeFileMap, extraPatterns);

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
      version: '0.4.0',
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
