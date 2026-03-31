import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname, parse } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RouteNode, RenderingStrategy } from '../../types.js';

interface AstroConfig {
  output?: 'static' | 'server' | 'hybrid';
}

export async function discoverRoutes(projectDir: string): Promise<RouteNode[]> {
  const routes: RouteNode[] = [];
  const pagesDir = join(projectDir, 'src', 'pages');

  // Check if src/pages exists
  try {
    await stat(pagesDir);
  } catch {
    return routes;
  }

  // Read astro config to determine default rendering
  const defaultRendering = await getDefaultRendering(projectDir);

  // Recursively scan for .astro files
  const astroFiles = await findAstroFiles(pagesDir);

  for (const filePath of astroFiles) {
    const relPath = relative(pagesDir, filePath);
    const routePath = astroFilePathToRoute(relPath);

    // Determine rendering strategy
    let rendering: RenderingStrategy = defaultRendering;

    // Check for prerender export in the file
    const content = await readFile(filePath, 'utf-8');
    if (hasExportPrerender(content, false)) {
      // prerender = false means SSR
      rendering = 'SSR';
    } else if (defaultRendering === 'SSG' || defaultRendering === 'Static') {
      // Default or explicitly static
      rendering = 'SSG';
    }

    const nodeId = randomUUID();
    const group = getRouteGroup(routePath);

    routes.push({
      id: nodeId,
      type: 'page',
      path: routePath,
      filePath: relative(projectDir, filePath),
      group,
      label: routePath,
      rendering,
    });
  }

  return routes;
}

async function getDefaultRendering(projectDir: string): Promise<RenderingStrategy> {
  const configPath = join(projectDir, 'astro.config.mjs');

  try {
    const content = await readFile(configPath, 'utf-8');

    // Parse astro.config.mjs for output setting
    if (/output\s*:\s*['"]server['"]/.test(content)) {
      return 'SSR';
    }
    if (/output\s*:\s*['"]hybrid['"]/.test(content)) {
      // hybrid means SSG by default, SSR by opt-in
      return 'SSG';
    }
  } catch {
    // Config doesn't exist, use defaults
  }

  // Default Astro behavior is static
  return 'SSG';
}

function astroFilePathToRoute(relPath: string): string {
  // Remove .astro extension
  let route = relPath.replace(/\.astro$/, '');

  // Convert index to /
  if (route === 'index') {
    return '/';
  }

  // Convert path separators
  route = route.replace(/\\/g, '/');

  // Ensure leading slash
  if (!route.startsWith('/')) {
    route = '/' + route;
  }

  return route;
}

function hasExportPrerender(content: string, value: boolean): boolean {
  const searchStr = `export const prerender = ${value}`;
  return content.includes(searchStr);
}

function getRouteGroup(path: string): string {
  const parts = path.split('/').filter(Boolean);

  // If no parts (path is /) or only one part (like /about), it's a root route
  if (parts.length <= 1) {
    return 'root';
  }

  // For nested routes like /blog/[slug], use the first segment as the group
  return parts[0];
}

async function findAstroFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (extname(entry.name) === '.astro') {
        files.push(fullPath);
      }
    }
  }

  await scan(dir);
  return files;
}
