import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RouteNode, HttpMethod } from '../../types.js';
import { computeGroup } from './routes.js';

export async function discoverApiRoutes(projectDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];
  const routesDir = join(projectDir, 'src', 'routes');

  const serverFiles = await findServerFiles(routesDir);

  for (const filePath of serverFiles) {
    const relPath = relative(routesDir, filePath);
    const routePath = serverFilePathToRoute(relPath);
    const relFromProject = relative(projectDir, filePath);

    // Extract HTTP methods from file
    const methods = await extractHttpMethods(filePath);

    nodes.push({
      id: randomUUID(),
      type: 'api',
      path: routePath,
      filePath: relFromProject,
      group: computeGroup(routePath),
      label: routePath,
      methods: methods.length > 0 ? methods : ['GET'],
      probe: { status: 'not-probed' },
    });
  }

  return nodes;
}

async function findServerFiles(routesDir: string): Promise<string[]> {
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
      } else if (entry.name === '+server.ts' || entry.name === '+server.js') {
        results.push(fullPath);
      }
    }
  }

  try {
    await walk(routesDir);
  } catch {
    return [];
  }

  return results.sort();
}

function serverFilePathToRoute(relPath: string): string {
  // Remove +server.ts filename (handle both with and without leading slash)
  let dir = relPath.replace(/[/\\]?\+server\.(ts|js)$/, '');

  // Handle root case
  if (!dir) return '/';

  const segments = dir.split(/[/\\]/).filter(Boolean);
  const routeSegments: string[] = [];

  for (const segment of segments) {
    // Strip route groups: (marketing) → skip
    if (segment.startsWith('(') && segment.endsWith(')')) continue;
    // Keep everything else (including [dynamic] and [...catchall])
    routeSegments.push(segment);
  }

  if (routeSegments.length === 0) return '/';
  return '/' + routeSegments.join('/');
}

async function extractHttpMethods(filePath: string): Promise<HttpMethod[]> {
  const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  const methods: HttpMethod[] = [];

  try {
    const content = await readFile(filePath, 'utf-8');

    // Match: export function GET, export const GET, export async function GET, etc.
    for (const method of validMethods) {
      const regex = new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${method}\\b`);
      if (regex.test(content)) {
        methods.push(method);
      }
    }
  } catch {
    // Ignore read errors
  }

  return methods;
}
