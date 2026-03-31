import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RouteNode, HttpMethod } from '../../types.js';
import { computeGroup } from './routes.js';

export async function discoverApiRoutes(projectDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];

  // App Router API routes (route.ts files)
  for (const base of ['app', join('src', 'app')]) {
    const appDir = join(projectDir, base);
    if (await dirExists(appDir)) {
      const routes = await scanAppRouterApi(projectDir, appDir);
      nodes.push(...routes);
    }
  }

  // Pages Router API routes (pages/api/)
  for (const base of ['pages', join('src', 'pages')]) {
    const apiDir = join(projectDir, base, 'api');
    if (await dirExists(apiDir)) {
      const routes = await scanPagesRouterApi(projectDir, join(projectDir, base), apiDir);
      nodes.push(...routes);
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

async function scanAppRouterApi(projectDir: string, appDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];
  const routeFiles = await findFiles(appDir, /^route\.(tsx?|jsx?|js)$/);

  for (const filePath of routeFiles) {
    const relPath = relative(appDir, filePath);
    const routePath = appRouterApiPathToRoute(relPath);
    const relFromProject = relative(projectDir, filePath);
    const methods = await detectHttpMethods(filePath);

    nodes.push({
      id: randomUUID(),
      type: 'api',
      path: routePath,
      filePath: relFromProject,
      group: computeGroup(routePath),
      label: routePath,
      methods,
      probe: { status: 'not-probed' },
    });
  }

  return nodes;
}

async function scanPagesRouterApi(
  projectDir: string,
  pagesBase: string,
  apiDir: string,
): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];
  const extensions = /\.(tsx?|jsx?|js)$/;
  const allFiles = await findFiles(apiDir, extensions);

  for (const filePath of allFiles) {
    const relPath = relative(pagesBase, filePath);
    const name = relPath.replace(extensions, '');
    const routePath = '/' + name.split(sep).join('/').replace(/\/index$/, '');
    const relFromProject = relative(projectDir, filePath);
    const methods = await detectPagesApiMethods(filePath);

    nodes.push({
      id: randomUUID(),
      type: 'api',
      path: routePath,
      filePath: relFromProject,
      group: computeGroup(routePath),
      label: routePath,
      methods,
      probe: { status: 'not-probed' },
    });
  }

  return nodes;
}

function appRouterApiPathToRoute(relPath: string): string {
  const dir = relPath.replace(/(?:^|[/\\])route\.(tsx?|jsx?|js)$/, '');
  if (!dir) return '/';
  const segments = dir.split(/[/\\]/).filter(Boolean);
  const routeSegments: string[] = [];

  for (const segment of segments) {
    if (segment.startsWith('(') && segment.endsWith(')')) continue;
    if (segment.startsWith('@')) continue;
    routeSegments.push(segment);
  }

  if (routeSegments.length === 0) return '/';
  return '/' + routeSegments.join('/');
}

async function detectHttpMethods(filePath: string): Promise<HttpMethod[]> {
  const methods: HttpMethod[] = [];
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return ['GET'];
  }

  const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  for (const method of httpMethods) {
    // Match: export async function GET, export function GET, export const GET
    const pattern = new RegExp(
      `export\\s+(?:async\\s+)?(?:function|const)\\s+${method}\\b`,
    );
    if (pattern.test(content)) {
      methods.push(method);
    }
  }

  return methods.length > 0 ? methods : ['GET'];
}

async function detectPagesApiMethods(filePath: string): Promise<HttpMethod[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return ['GET', 'POST'];
  }

  const methods: HttpMethod[] = [];
  const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of httpMethods) {
    // Match: req.method === 'GET' or req.method === "GET"
    if (content.includes(`'${method}'`) || content.includes(`"${method}"`)) {
      methods.push(method);
    }
  }

  // If no method checks found, it handles all methods (default handler)
  return methods.length > 0 ? methods : ['GET', 'POST'];
}

async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
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
