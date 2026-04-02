import { randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { RenderingStrategy, RouteNode } from '../../types.js';

export async function discoverPageRoutes(projectDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];
  const routesDir = join(projectDir, 'src', 'routes');

  const pageFiles = await findPageFiles(routesDir);

  for (const filePath of pageFiles) {
    const relPath = relative(routesDir, filePath);
    const routePath = pageFilePathToRoute(relPath);
    const relFromProject = relative(projectDir, filePath);

    // Detect rendering strategy by checking sibling files
    const rendering = await detectRenderingStrategy(routesDir, relPath);

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

async function findPageFiles(routesDir: string): Promise<string[]> {
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
      } else if (entry.name === '+page.svelte') {
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

function pageFilePathToRoute(relPath: string): string {
  // Remove +page.svelte filename (handle both with and without leading slash)
  const dir = relPath.replace(/[/\\]?\+page\.svelte$/, '');

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
  return `/${routeSegments.join('/')}`;
}

export function computeGroup(routePath: string): string {
  if (routePath === '/') return 'root';
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) return 'root';
  // Group by first segment
  return segments[0];
}

async function detectRenderingStrategy(routesDir: string, pageRelPath: string): Promise<RenderingStrategy> {
  // Get directory containing the +page.svelte
  const pageDir = pageRelPath.replace(/[/\\]\+page\.svelte$/, '');
  const dirPath = pageDir ? join(routesDir, pageDir) : routesDir;

  const dirContent = await readDirContents(dirPath);

  // Check for +page.server.ts with load export (SSR)
  if (dirContent.has('+page.server.ts') || dirContent.has('+page.server.js')) {
    const content =
      (await tryReadFile(join(dirPath, '+page.server.ts'))) || (await tryReadFile(join(dirPath, '+page.server.js')));
    if (content && /export\s+(?:async\s+)?function\s+load|export\s+const\s+load/.test(content)) {
      return 'SSR';
    }
  }

  // Check for +page.ts with load export (universal load, SSR)
  if (dirContent.has('+page.ts') || dirContent.has('+page.js')) {
    const content = (await tryReadFile(join(dirPath, '+page.ts'))) || (await tryReadFile(join(dirPath, '+page.js')));
    if (content) {
      if (/export\s+(?:async\s+)?function\s+load|export\s+const\s+load/.test(content)) {
        return 'SSR';
      }
      // Check for prerender
      if (/export\s+const\s+prerender\s*=\s*true/.test(content)) {
        return 'SSG';
      }
      // Check for ssr = false (client-side)
      if (/export\s+const\s+ssr\s*=\s*false/.test(content)) {
        return 'Client';
      }
    }
  }

  // Check for prerender in +page.server.ts
  if (dirContent.has('+page.server.ts') || dirContent.has('+page.server.js')) {
    const content =
      (await tryReadFile(join(dirPath, '+page.server.ts'))) || (await tryReadFile(join(dirPath, '+page.server.js')));
    if (content && /export\s+const\s+prerender\s*=\s*true/.test(content)) {
      return 'SSG';
    }
  }

  // Default: Static (no load, no config)
  return 'Static';
}

async function readDirContents(dirPath: string): Promise<Set<string>> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: false });
    return new Set(entries as string[]);
  } catch {
    return new Set();
  }
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}
