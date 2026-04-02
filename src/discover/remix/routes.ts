import { randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { RenderingStrategy, RouteNode } from '../../types.js';

export async function discoverRoutes(projectDir: string): Promise<RouteNode[]> {
  const nodeMap = new Map<string, RouteNode>();
  const routesDir = join(projectDir, 'app', 'routes');

  if (!(await dirExists(routesDir))) {
    return [];
  }

  const files = await findRouteFiles(routesDir);

  // Build a map of which files exist for grouping logic
  const fileNames = new Set(files.map((f) => relative(routesDir, f)));

  for (const filePath of files) {
    const relPath = relative(routesDir, filePath);
    const routePath = flatRouteToPath(relPath);
    const relFromProject = relative(projectDir, filePath);

    // Check if this is a page route (has default export)
    const hasDefaultExport = await hasDefaultComponentExport(filePath);
    if (!hasDefaultExport) {
      continue; // This will be handled as API route in discoverApiRoutes
    }

    const rendering = await detectRenderingStrategy(filePath);

    const node: RouteNode = {
      id: randomUUID(),
      type: 'page',
      path: routePath,
      filePath: relFromProject,
      group: computeGroupWithFileContext(routePath, relPath, fileNames),
      label: routePath === '/' ? 'Home' : routePath,
      rendering,
      probe: { status: 'not-probed' },
    };

    // Handle ._index files: if a route for this path already exists (from parent file),
    // don't add a duplicate. The parent file (layout) takes precedence.
    const isIndexFile = relPath.includes('._index');
    if (isIndexFile && nodeMap.has(routePath)) {
      // Skip: we already have the parent file for this path
      continue;
    }

    nodeMap.set(routePath, node);
  }

  return Array.from(nodeMap.values());
}

export async function discoverApiRoutes(projectDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];
  const routesDir = join(projectDir, 'app', 'routes');

  if (!(await dirExists(routesDir))) {
    return nodes;
  }

  const files = await findRouteFiles(routesDir);

  // Build a map of which files exist for grouping logic
  const fileNames = new Set(files.map((f) => relative(routesDir, f)));

  for (const filePath of files) {
    const relPath = relative(routesDir, filePath);
    const content = await readFile(filePath, 'utf-8');

    // API routes have no default export but have loader/action
    const hasDefaultExport = await hasDefaultComponentExport(filePath);
    const hasLoader = /export\s+(?:async\s+)?function\s+loader\s*\(|export\s+const\s+loader\s*=/m.test(content);
    const hasAction = /export\s+(?:async\s+)?function\s+action\s*\(|export\s+const\s+action\s*=/m.test(content);

    if (hasDefaultExport || (!hasLoader && !hasAction)) {
      continue;
    }

    const routePath = flatRouteToPath(relPath);
    const relFromProject = relative(projectDir, filePath);
    const methods: ('GET' | 'POST')[] = [];

    if (hasLoader) methods.push('GET');
    if (hasAction) methods.push('POST');

    nodes.push({
      id: randomUUID(),
      type: 'api',
      path: routePath,
      filePath: relFromProject,
      group: computeGroupWithFileContext(routePath, relPath, fileNames),
      label: routePath,
      methods: methods.length > 0 ? methods : undefined,
      probe: { status: 'not-probed' },
    });
  }

  return nodes;
}

function flatRouteToPath(relPath: string): string {
  // Remove file extension
  const withoutExt = relPath.replace(/\.(tsx?|jsx?)$/, '');

  // Handle root index route
  if (withoutExt === '_index') {
    return '/';
  }

  // Split by dots and handle special cases
  const segments = withoutExt.split('.');
  const routeSegments: string[] = [];

  for (const segment of segments) {
    // _index becomes nothing (handled above for root case)
    if (segment === '_index') {
      continue;
    }
    // $param becomes [param]
    if (segment.startsWith('$')) {
      routeSegments.push(`[${segment.slice(1)}]`);
    }
    // _layout becomes nothing (pathless layout)
    else if (segment.startsWith('_')) {
    }
    // Regular segment
    else {
      routeSegments.push(segment);
    }
  }

  if (routeSegments.length === 0) {
    return '/';
  }

  return `/${routeSegments.join('/')}`;
}

async function detectRenderingStrategy(filePath: string): Promise<RenderingStrategy> {
  const content = await readFile(filePath, 'utf-8');

  // Check for loader/action/clientLoader exports
  const hasLoader = /export\s+(?:async\s+)?function\s+loader\s*\(|export\s+const\s+loader\s*=/m.test(content);
  const hasClientLoader = /export\s+(?:async\s+)?function\s+clientLoader\s*\(|export\s+const\s+clientLoader\s*=/m.test(
    content,
  );
  const hasAction = /export\s+(?:async\s+)?function\s+action\s*\(|export\s+const\s+action\s*=/m.test(content);

  if (hasLoader) {
    return 'SSR';
  }

  if (hasClientLoader) {
    return 'Client';
  }

  if (hasAction) {
    return 'SSR'; // action requires server
  }

  return 'Static';
}

function computeGroupWithFileContext(routePath: string, _relPath: string, fileNames: Set<string>): string {
  if (routePath === '/') return 'root';
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) return 'root';

  // For single-segment routes, check if this file has nested children
  if (segments.length === 1) {
    const segment = segments[0];
    // Check if there are any files that start with this segment followed by a dot
    // (indicating nested routes like dashboard.settings.tsx under dashboard.tsx)
    const hasNestedRoutes = Array.from(fileNames).some((file) => {
      const fileName = file.replace(/\.(tsx?|jsx?)$/, '');
      return fileName.startsWith(`${segment}.`);
    });

    if (hasNestedRoutes) {
      return segment;
    } else {
      return 'root';
    }
  }

  // For multi-segment routes, group by first segment
  return segments[0];
}

async function findRouteFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const extensions = /\.(tsx?|jsx?)$/;

  async function walk(current: string) {
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        await walk(fullPath);
      } else if (extensions.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const s = await stat(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function hasDefaultComponentExport(filePath: string): Promise<boolean> {
  const content = await readFile(filePath, 'utf-8');
  // Look for "export default" followed by function, component, or const
  return /export\s+default\s+(?:function|const|class|async\s+function)/m.test(content);
}
