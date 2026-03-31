import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MiddlewareNode, Connector } from '../../types.js';

interface MiddlewareResult {
  node: MiddlewareNode;
  connectors: Connector[];
}

export async function discoverMiddleware(
  projectDir: string,
  routeNodeIds: Map<string, string>,
): Promise<MiddlewareResult | null> {
  const hooksPath = join(projectDir, 'src', 'hooks.server.ts');
  const hooksPathJs = join(projectDir, 'src', 'hooks.server.js');

  let hooksContent: string | null = null;
  let filePath = '';

  try {
    hooksContent = await readFile(hooksPath, 'utf-8');
    filePath = 'src/hooks.server.ts';
  } catch {
    try {
      hooksContent = await readFile(hooksPathJs, 'utf-8');
      filePath = 'src/hooks.server.js';
    } catch {
      return null;
    }
  }

  // Verify handle export exists
  if (!/export\s+(?:async\s+)?(?:function|const)\s+handle\b/.test(hooksContent)) {
    return null;
  }

  // Detect auth patterns
  const authProvider = detectAuthProvider(hooksContent);

  const node: MiddlewareNode = {
    id: randomUUID(),
    type: 'middleware',
    filePath,
    label: 'hooks.server',
    group: 'middleware',
    matcherPatterns: ['/*'],
    runtime: 'node',
    ...(authProvider && { authProvider }),
  };

  // Create connectors from middleware to all route nodes
  const connectors: Connector[] = Array.from(routeNodeIds.values()).map((routeId) => ({
    source: node.id,
    target: routeId,
    type: 'middleware-coverage',
    confidence: 'static',
    label: 'applies to',
    style: 'dashed',
    color: 'amber',
  }));

  return { node, connectors };
}

function detectAuthProvider(content: string): string | undefined {
  // Check for common auth keywords
  // Order matters: check more specific patterns first
  const authPatterns = [
    { pattern: /oauth|openid/i, name: 'OAuth' },
    { pattern: /redirect|location/i, name: 'Custom' },
    { pattern: /session|auth|jwt/i, name: 'Session-based' },
    { pattern: /cookie/i, name: 'Cookie-based' },
    { pattern: /bearer|token/i, name: 'Token-based' },
  ];

  for (const { pattern, name } of authPatterns) {
    if (pattern.test(content)) {
      return name;
    }
  }

  return undefined;
}
