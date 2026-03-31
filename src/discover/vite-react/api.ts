import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RouteNode } from '../../types.js';
import { computeGroup } from './routes.js';

export async function discoverApiRoutes(projectDir: string): Promise<RouteNode[]> {
  const srcDir = join(projectDir, 'src');

  // Check if src directory exists
  if (!(await dirExists(srcDir))) {
    return [];
  }

  const nodes: RouteNode[] = [];
  const sourceFiles = await findFiles(srcDir, /\.(tsx?|jsx?)$/);

  // Track detected API endpoints to avoid duplicates
  const detectedApis = new Set<string>();

  for (const filePath of sourceFiles) {
    let content: string;

    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Find fetch('/api/...') calls to detect consumed API endpoints
    const apiEndpoints = extractApiCalls(content);

    for (const endpoint of apiEndpoints) {
      if (!detectedApis.has(endpoint)) {
        detectedApis.add(endpoint);
        const relPath = relative(projectDir, filePath);

        nodes.push({
          id: randomUUID(),
          type: 'api',
          path: endpoint,
          filePath: relPath,
          group: computeGroup(endpoint),
          label: endpoint,
          probe: { status: 'not-probed' },
        });
      }
    }
  }

  return nodes;
}

function extractApiCalls(content: string): string[] {
  const apis: string[] = [];

  // Match fetch('/api/...'), fetch("/api/..."), fetch(`/api/...`)
  const fetchPattern = /fetch\s*\(\s*['"`]\/api\/([^'"`]*)['""`]/g;
  let match;

  while ((match = fetchPattern.exec(content)) !== null) {
    const path = '/api/' + match[1];
    apis.push(path);
  }

  return [...new Set(apis)]; // Deduplicate
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
