import { randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { RouteNode } from '../../types.js';

export async function discoverRoutes(projectDir: string): Promise<RouteNode[]> {
  const srcDir = join(projectDir, 'src');

  // Check if src directory exists
  if (!(await dirExists(srcDir))) {
    return [];
  }

  const nodes: RouteNode[] = [];

  // Scan all source files for route configurations
  const sourceFiles = await findFiles(srcDir, /\.(tsx?|jsx?)$/);

  for (const filePath of sourceFiles) {
    const relPath = relative(projectDir, filePath);
    let content: string;

    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Extract routes from createBrowserRouter or createHashRouter
    const routes = extractRoutesFromConfig(content);

    for (const route of routes) {
      const nodeId = randomUUID();
      const group = computeGroup(route.path);

      nodes.push({
        id: nodeId,
        type: 'page',
        path: route.path,
        filePath: relPath,
        group,
        label: route.path === '/' ? 'Home' : route.path,
        rendering: 'Client',
        probe: { status: 'not-probed' },
      });
    }
  }

  // Deduplicate by path
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.path)) return false;
    seen.add(node.path);
    return true;
  });
}

function extractRoutesFromConfig(content: string): Array<{ path: string }> {
  const routes: Array<{ path: string }> = [];

  // Match createBrowserRouter or createHashRouter with route config arrays
  // Pattern: createBrowserRouter([ ... ]) or createHashRouter([ ... ])
  const routerPattern = /create(?:Browser|Hash)Router\s*\(\s*\[\s*([\s\S]*?)\s*\]\s*\)/;
  const routerMatch = content.match(routerPattern);

  if (routerMatch) {
    const configContent = routerMatch[1];

    // Extract route objects: { path: '...', ... }
    const routeObjectPattern = /\{\s*path\s*:\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null = routeObjectPattern.exec(configContent);

    while (match !== null) {
      let path = match[1];
      // Normalize dynamic segments: :id -> [id]
      path = normalizeDynamicSegments(path);
      routes.push({ path });
      match = routeObjectPattern.exec(configContent);
    }
  }

  return routes;
}

function normalizeDynamicSegments(path: string): string {
  // Convert :id -> [id], :userId -> [userId], etc.
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '[$1]');
}

export function computeGroup(routePath: string): string {
  if (routePath === '/') return 'root';
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) return 'root';
  // Group by first segment
  return segments[0];
}

async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
  const results: string[] = [];

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
        // Skip node_modules and hidden dirs
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        await walk(fullPath);
      } else if (pattern.test(entry.name)) {
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
