import { readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RouteNode } from '../../types.js';

const ROUTE_DIRS = ['pages', 'routes', 'views', 'src/pages', 'src/routes', 'src/views'];

export async function discoverRoutes(projectDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];

  for (const routeDir of ROUTE_DIRS) {
    const fullPath = join(projectDir, routeDir);
    const files = await findFilesInDir(fullPath);

    for (const filePath of files) {
      const relPath = relative(projectDir, filePath);
      const routePath = filePathToRoutePath(filePath, fullPath);

      const nodeId = randomUUID();
      const group = computeGroup(routePath);

      nodes.push({
        id: nodeId,
        type: 'page',
        path: routePath,
        filePath: relPath,
        group,
        label: routePath === '/' ? 'Home' : routePath,
        rendering: 'Unknown',
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

function filePathToRoutePath(filePath: string, baseDir: string): string {
  // Get relative path from baseDir
  let relativePath = relative(baseDir, filePath);

  // Remove extension
  relativePath = relativePath.replace(extname(relativePath), '');

  // Convert backslashes to forward slashes (Windows compatibility)
  relativePath = relativePath.replace(/\\/g, '/');

  // Convert 'index' to '/'
  if (relativePath === 'index' || relativePath.endsWith('/index')) {
    const dirPart = relativePath.replace(/\/index$/, '');
    return dirPart ? `/${dirPart}` : '/';
  }

  // Add leading slash
  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
}

export function computeGroup(routePath: string): string {
  if (routePath === '/') return 'root';
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) return 'root';
  // Group by first segment
  return segments[0];
}

async function findFilesInDir(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    let entries;
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
      } else if (/\.(tsx?|jsx?|svelte|vue|astro)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  try {
    await walk(dir);
  } catch {
    // Directory doesn't exist
  }

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
