import { randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import type { HttpMethod, RouteNode } from '../../types.js';

const API_DIRS = ['api', 'server/api', 'src/api'];

export async function discoverApiRoutes(projectDir: string): Promise<RouteNode[]> {
  const nodes: RouteNode[] = [];

  for (const apiDir of API_DIRS) {
    const fullPath = join(projectDir, apiDir);
    const files = await findFilesInDir(fullPath);

    for (const filePath of files) {
      const relPath = relative(projectDir, filePath);
      const apiPath = filePathToApiPath(filePath, fullPath);

      const nodeId = randomUUID();
      const group = computeGroup(apiPath);

      nodes.push({
        id: nodeId,
        type: 'api',
        path: apiPath,
        filePath: relPath,
        group,
        label: apiPath,
        methods: ['GET'] as HttpMethod[],
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

function filePathToApiPath(filePath: string, baseDir: string): string {
  // Get relative path from baseDir
  let relativePath = relative(baseDir, filePath);

  // Remove extension
  relativePath = relativePath.replace(extname(relativePath), '');

  // Convert backslashes to forward slashes (Windows compatibility)
  relativePath = relativePath.replace(/\\/g, '/');

  // Convert 'index' to just the directory path
  if (relativePath === 'index') {
    return '/';
  }
  if (relativePath.endsWith('/index')) {
    relativePath = relativePath.replace(/\/index$/, '');
  }

  // Add leading slash and /api prefix
  return `/api${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`;
}

export function computeGroup(apiPath: string): string {
  // Group API routes by first segment after /api/
  const segments = apiPath.split('/').filter((_s, i) => i > 1); // Skip empty and 'api'
  if (segments.length === 0) return 'api';
  return segments[0];
}

async function findFilesInDir(dir: string): Promise<string[]> {
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
      } else if (/\.(tsx?|jsx?|js)$/.test(entry.name)) {
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
