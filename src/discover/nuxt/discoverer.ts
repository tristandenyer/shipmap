import { randomUUID } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import type { Connector, HttpMethod, MiddlewareNode, RouteNode } from '../../types.js';
import { discoverExternals } from '../nextjs/externals.js';
import type { FrameworkDiscoverer, MiddlewareResult } from '../types.js';

interface FileRoute {
  filePath: string;
  path: string;
  isClientOnly: boolean;
}

async function discoverRoutes(projectDir: string): Promise<RouteNode[]> {
  const pagesDir = join(projectDir, 'pages');
  const routes: RouteNode[] = [];
  const fileRoutes = new Map<string, string>(); // filePath → node ID

  // Check if pages directory exists
  if (!(await dirExists(pagesDir))) {
    return routes;
  }

  // Check if global SSR is disabled in nuxt.config
  const globalSPAMode = await isGlobalSPAMode(projectDir);

  // Collect all route files
  const fileRoutesList = await collectRouteFiles(pagesDir, projectDir);

  for (const fileRoute of fileRoutesList) {
    const nodeId = randomUUID();
    fileRoutes.set(fileRoute.filePath, nodeId);

    // Determine rendering strategy
    let rendering: 'SSR' | 'Client' = 'SSR';
    if (globalSPAMode || fileRoute.isClientOnly) {
      rendering = 'Client';
    }

    // Extract group (first path segment)
    const pathSegments = fileRoute.path.split('/').filter(Boolean);
    const group = pathSegments.length > 0 ? pathSegments[0] : 'root';

    const route: RouteNode = {
      id: nodeId,
      type: 'page',
      path: fileRoute.path,
      filePath: fileRoute.filePath,
      group,
      label: basename(fileRoute.filePath, '.vue'),
      rendering,
    };

    routes.push(route);
  }

  return routes;
}

async function discoverApiRoutes(projectDir: string): Promise<RouteNode[]> {
  const apiDir = join(projectDir, 'server', 'api');
  const routes: RouteNode[] = [];

  // Check if server/api directory exists
  if (!(await dirExists(apiDir))) {
    return routes;
  }

  const apiRoutes = await collectApiRouteFiles(apiDir, projectDir);

  for (const apiRoute of apiRoutes) {
    const nodeId = randomUUID();

    // Extract group (first path segment, or 'api' for root)
    const pathSegments = apiRoute.path.split('/').filter(Boolean);
    const group = pathSegments.length > 1 ? pathSegments[0] : 'api';

    const route: RouteNode = {
      id: nodeId,
      type: 'api',
      path: apiRoute.path,
      filePath: apiRoute.filePath,
      group,
      label: basename(apiRoute.filePath),
      methods: apiRoute.methods as HttpMethod[],
    };

    routes.push(route);
  }

  return routes;
}

async function discoverMiddleware(
  projectDir: string,
  routeNodeIds: Map<string, string>,
): Promise<MiddlewareResult | null> {
  // Check server/middleware first, then middleware
  const serverMiddlewarePath = join(projectDir, 'server', 'middleware');
  const routeMiddlewarePath = join(projectDir, 'middleware');

  let middlewarePath: string | null = null;
  let middlewareFile: string | null = null;

  if (await dirExists(serverMiddlewarePath)) {
    const files = await readdir(serverMiddlewarePath);
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        middlewareFile = file;
        middlewarePath = join(serverMiddlewarePath, file);
        break;
      }
    }
  }

  if (!middlewarePath && (await dirExists(routeMiddlewarePath))) {
    const files = await readdir(routeMiddlewarePath);
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        middlewareFile = file;
        middlewarePath = join(routeMiddlewarePath, file);
        break;
      }
    }
  }

  if (!middlewarePath || !middlewareFile) {
    return null;
  }

  let content: string;
  try {
    content = await readFile(middlewarePath, 'utf-8');
  } catch {
    return null;
  }

  const relPath = middlewarePath.startsWith(projectDir) ? middlewarePath.slice(projectDir.length + 1) : middlewarePath;

  const authProvider = detectAuthProvider(content);

  const nodeId = randomUUID();
  const node: MiddlewareNode = {
    id: nodeId,
    type: 'middleware',
    filePath: relPath,
    label: middlewareFile.replace(/\.(ts|js)$/, ''),
    group: 'middleware',
    matcherPatterns: ['/*'],
    authProvider: authProvider || undefined,
    runtime: 'node',
  };

  // Create connectors for all routes (middleware runs on all requests)
  const connectors: Connector[] = [];
  for (const [_, routeId] of routeNodeIds) {
    connectors.push({
      source: nodeId,
      target: routeId,
      type: 'middleware-coverage',
      confidence: 'static',
      label: 'middleware coverage',
      style: 'dashed',
      color: 'orange',
    });
  }

  return { node, connectors };
}

export const nuxtDiscoverer: FrameworkDiscoverer = {
  discoverRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};

// Helper functions

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function isGlobalSPAMode(projectDir: string): Promise<boolean> {
  const configPaths = [join(projectDir, 'nuxt.config.ts'), join(projectDir, 'nuxt.config.js')];

  for (const configPath of configPaths) {
    if (await fileExists(configPath)) {
      try {
        const content = await readFile(configPath, 'utf-8');
        if (/ssr\s*:\s*false/.test(content)) {
          return true;
        }
      } catch {
        // continue
      }
    }
  }

  return false;
}

async function collectRouteFiles(pagesDir: string, projectDir: string): Promise<FileRoute[]> {
  const routes: FileRoute[] = [];

  async function walk(dir: string, prefix: string = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = prefix ? join(prefix, entry.name) : entry.name;

        if (entry.isDirectory()) {
          // Skip special directories
          if (!entry.name.startsWith('.')) {
            await walk(fullPath, relativePath);
          }
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.vue') || entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))
        ) {
          // Check for client-only rendering
          let isClientOnly = false;
          try {
            const content = await readFile(fullPath, 'utf-8');
            isClientOnly = /definePageMeta\s*\(\s*{\s*[^}]*ssr\s*:\s*false/.test(content);
          } catch {
            // default to SSR
          }

          // Convert file path to route path
          const routePath = filePathToRoute(relativePath);
          const relativeToProject = relative(projectDir, fullPath);

          routes.push({
            filePath: relativeToProject,
            path: routePath,
            isClientOnly,
          });
        }
      }
    } catch {
      // skip directories that can't be read
    }
  }

  await walk(pagesDir);
  return routes;
}

async function collectApiRouteFiles(
  apiDir: string,
  projectDir: string,
): Promise<Array<{ filePath: string; path: string; methods: string[] }>> {
  const routes: Array<{ filePath: string; path: string; methods: string[] }> = [];

  async function walk(dir: string, prefix: string = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = prefix ? join(prefix, entry.name) : entry.name;

        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.')) {
            await walk(fullPath, relativePath);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          // Extract HTTP method from filename or content
          const methods = extractHttpMethods(entry.name);

          // Convert file path to API route path
          const routePath = filePathToApiRoute(relativePath);
          const relativeToProject = relative(projectDir, fullPath);

          routes.push({
            filePath: relativeToProject,
            path: routePath,
            methods,
          });
        }
      }
    } catch {
      // skip directories that can't be read
    }
  }

  await walk(apiDir);
  return routes;
}

function filePathToRoute(filePath: string): string {
  // Remove extension
  let path = filePath.replace(/\.(vue|tsx?|jsx?)$/, '');

  // Handle index files
  if (path.endsWith('/index')) {
    path = path.slice(0, -6) || '/';
  } else if (path === 'index') {
    path = '/';
  }

  // Normalize path format
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  return path;
}

function filePathToApiRoute(filePath: string): string {
  // Remove method suffix and extension (e.g., users.get.ts → users)
  let path = filePath.replace(/\.(ts|js)$/, '');
  path = path.replace(/\.(get|post|put|delete|patch|head|options)$/, '');

  // Handle index files
  if (path.endsWith('/index')) {
    path = path.slice(0, -6);
  } else if (path === 'index') {
    path = '';
  }

  // Prepend /api and normalize
  const apiPath = `/api${path ? `/${path}` : ''}`;
  return apiPath;
}

function extractHttpMethods(fileName: string): string[] {
  // Check for method in filename (e.g., users.get.ts)
  const methodMatch = fileName.match(/\.(get|post|put|delete|patch|head|options)\./i);
  if (methodMatch) {
    return [methodMatch[1].toUpperCase()];
  }

  // Default: GET and POST (requires runtime inspection to determine which)
  return ['GET', 'POST'];
}

function detectAuthProvider(content: string): string | null {
  if (/auth|session|token/i.test(content)) {
    return 'Custom';
  }
  return null;
}
