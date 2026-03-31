import { readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RouteNode, RenderingStrategy } from '../../types.js';
import { detectRenderingStrategy } from './rendering.js';

export async function discoverPageRoutes(projectDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];

  // App Router
  const appDir = join(projectDir, 'app');
  if (await dirExists(appDir)) {
    const appRoutes = await scanAppRouter(projectDir, appDir);
    nodes.push(...appRoutes);
  }

  // Also check src/app
  const srcAppDir = join(projectDir, 'src', 'app');
  if (await dirExists(srcAppDir)) {
    const srcAppRoutes = await scanAppRouter(projectDir, srcAppDir);
    nodes.push(...srcAppRoutes);
  }

  // Pages Router
  const pagesDir = join(projectDir, 'pages');
  if (await dirExists(pagesDir)) {
    const pageRoutes = await scanPagesRouter(projectDir, pagesDir);
    nodes.push(...pageRoutes);
  }

  // Also check src/pages
  const srcPagesDir = join(projectDir, 'src', 'pages');
  if (await dirExists(srcPagesDir)) {
    const srcPageRoutes = await scanPagesRouter(projectDir, srcPagesDir);
    nodes.push(...srcPageRoutes);
  }

  // Deduplicate by path (App Router takes precedence)
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.path)) return false;
    seen.add(node.path);
    return true;
  });
}

async function scanAppRouter(projectDir: string, appDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];
  const pageFiles = await findFiles(appDir, /^page\.(tsx?|jsx?)$/);

  for (const filePath of pageFiles) {
    const relPath = relative(appDir, filePath);
    const routePath = appRouterPathToRoute(relPath);
    const relFromProject = relative(projectDir, filePath);

    const rendering = await detectRenderingStrategy(filePath);

    nodes.push({
      id: randomUUID(),
      type: 'page',
      path: routePath,
      filePath: relFromProject,
      group: computeGroup(routePath),
      label: routePath === '/' ? 'Home' : routePath,
      rendering,
      probe: { status: 'not-probed' },
    });
  }

  return nodes;
}

async function scanPagesRouter(projectDir: string, pagesDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];
  const pageExtensions = /\.(tsx?|jsx?)$/;
  const skipFiles = new Set(['_app', '_document', '_error', '404', '500']);
  const allFiles = await findFiles(pagesDir, pageExtensions);

  for (const filePath of allFiles) {
    const relPath = relative(pagesDir, filePath);
    const name = relPath.replace(pageExtensions, '');

    // Skip special Next.js files and API routes
    const baseName = name.split(sep).pop() || '';
    if (skipFiles.has(baseName)) continue;
    if (relPath.startsWith('api' + sep) || relPath === 'api') continue;

    const routePath = pagesRouterPathToRoute(name);
    const relFromProject = relative(projectDir, filePath);

    const rendering = await detectRenderingStrategy(filePath);

    nodes.push({
      id: randomUUID(),
      type: 'page',
      path: routePath,
      filePath: relFromProject,
      group: computeGroup(routePath),
      label: routePath === '/' ? 'Home' : routePath,
      rendering,
      probe: { status: 'not-probed' },
    });
  }

  return nodes;
}

function appRouterPathToRoute(relPath: string): string {
  // Remove page.tsx filename
  const dir = relPath.replace(/(?:^|[/\\])page\.(tsx?|jsx?)$/, '');
  if (!dir) return '/';

  const segments = dir.split(/[/\\]/).filter(Boolean);
  const routeSegments: string[] = [];

  for (const segment of segments) {
    // Strip route groups: (marketing) → skip
    if (segment.startsWith('(') && segment.endsWith(')')) continue;
    // Strip parallel routes: @modal → skip
    if (segment.startsWith('@')) continue;
    // Keep everything else (including [dynamic] and [...catchall])
    routeSegments.push(segment);
  }

  if (routeSegments.length === 0) return '/';
  return '/' + routeSegments.join('/');
}

function pagesRouterPathToRoute(name: string): string {
  const segments = name.split(/[/\\]/);

  // Handle index files
  if (segments[segments.length - 1] === 'index') {
    segments.pop();
  }

  if (segments.length === 0) return '/';
  return '/' + segments.join('/');
}

export function computeGroup(routePath: string): string {
  if (routePath === '/') return 'root';
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length <= 1) return 'root';
  // Group by first segment
  return segments[0];
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
