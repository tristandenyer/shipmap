import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Connector, MiddlewareNode } from '../../types.js';
import type { MiddlewareResult } from '../types.js';

export async function discoverMiddleware(
  projectDir: string,
  routeNodeIds: Map<string, string>,
): Promise<MiddlewareResult | null> {
  // Check for middleware files
  const middlewarePaths = [
    join(projectDir, 'src', 'middleware.ts'),
    join(projectDir, 'src', 'middleware.js'),
    join(projectDir, 'src', 'middleware', 'index.ts'),
  ];

  let middlewareFile: string | null = null;

  for (const path of middlewarePaths) {
    try {
      await stat(path);
      middlewareFile = path;
      break;
    } catch {
      // File doesn't exist, continue
    }
  }

  if (!middlewareFile) {
    return null;
  }

  const content = await readFile(middlewareFile, 'utf-8');

  // Check for onRequest or sequence exports
  const hasOnRequest = /export\s+(?:const|function)\s+onRequest/.test(content);
  const hasSequence = /export\s+const\s+sequence/.test(content);

  if (!hasOnRequest && !hasSequence) {
    return null;
  }

  const nodeId = randomUUID();

  const node: MiddlewareNode = {
    id: nodeId,
    type: 'middleware',
    filePath: relative(projectDir, middlewareFile),
    label: 'Middleware',
    group: 'middleware',
    matcherPatterns: ['/*'],
    runtime: 'node',
  };

  // Detect auth patterns
  if (/redirect|token|cookie|auth|login/.test(content)) {
    node.authProvider = 'Custom';
  }

  // Detect redirect target
  const redirectMatch = content.match(/redirect\(['"]([^'"]+)['"]/);
  if (redirectMatch) {
    node.redirectTarget = redirectMatch[1];
  }

  // Create connectors to all routes
  const connectors: Connector[] = [];

  for (const [_routePath, routeId] of routeNodeIds) {
    connectors.push({
      source: nodeId,
      target: routeId,
      type: 'middleware-coverage',
      confidence: 'static',
      label: 'middleware',
      style: 'dashed',
      color: 'orange',
    });
  }

  return { node, connectors };
}
