import { randomUUID } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import type { HttpMethod, RouteNode } from '../../types.js';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

export async function discoverApiRoutes(projectDir: string): Promise<RouteNode[]> {
  const routes: RouteNode[] = [];
  const pagesDir = join(projectDir, 'src', 'pages');

  // Check if src/pages exists
  try {
    await stat(pagesDir);
  } catch {
    return routes;
  }

  // Find all .ts and .js files in src/pages
  const tsFiles = await findTsJsFiles(pagesDir);

  for (const filePath of tsFiles) {
    const relPath = relative(pagesDir, filePath);
    const routePath = tsFilePathToRoute(relPath);

    // Read file to detect HTTP handler exports
    const content = await readFile(filePath, 'utf-8');
    const methods = detectHttpMethods(content);

    // Only include if it has HTTP handlers
    if (methods.length > 0) {
      const nodeId = randomUUID();
      const group = getRouteGroup(routePath);

      routes.push({
        id: nodeId,
        type: 'api',
        path: routePath,
        filePath: relative(projectDir, filePath),
        group,
        label: routePath,
        methods,
      });
    }
  }

  return routes;
}

function tsFilePathToRoute(relPath: string): string {
  // Remove .ts or .js extension
  let route = relPath.replace(/\.(ts|js)$/, '');

  // Convert path separators
  route = route.replace(/\\/g, '/');

  // Ensure leading slash
  if (!route.startsWith('/')) {
    route = `/${route}`;
  }

  return route;
}

function getRouteGroup(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[0] || 'root';
}

function detectHttpMethods(content: string): HttpMethod[] {
  const methods: HttpMethod[] = [];

  for (const method of HTTP_METHODS) {
    // Match: export const GET, export async function GET, export function GET
    const patterns = [
      new RegExp(`export\\s+const\\s+${method}\\s*=`),
      new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`),
      new RegExp(`export\\s+function\\s+${method}\\s*\\(`),
    ];

    if (patterns.some((p) => p.test(content))) {
      methods.push(method);
    }
  }

  return methods;
}

async function findTsJsFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else {
        const ext = extname(entry.name);
        if (ext === '.ts' || ext === '.js') {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(dir);
  return files;
}
