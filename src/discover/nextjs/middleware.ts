import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Connector, MiddlewareNode } from '../../types.js';

interface MiddlewareResult {
  node: MiddlewareNode;
  connectors: Connector[];
}

export async function discoverMiddleware(
  projectDir: string,
  routeNodeIds: Map<string, string>, // path → node ID
): Promise<MiddlewareResult | null> {
  // Check common locations
  const candidates = [
    join(projectDir, 'middleware.ts'),
    join(projectDir, 'middleware.js'),
    join(projectDir, 'src', 'middleware.ts'),
    join(projectDir, 'src', 'middleware.js'),
  ];

  let middlewarePath: string | null = null;
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      middlewarePath = candidate;
      break;
    }
  }

  if (!middlewarePath) return null;

  let content: string;
  try {
    content = await readFile(middlewarePath, 'utf-8');
  } catch {
    return null;
  }

  const relPath = middlewarePath.startsWith(projectDir) ? middlewarePath.slice(projectDir.length + 1) : middlewarePath;

  const matchers = extractMatchers(content);
  const authProvider = detectAuthProvider(content);
  const redirectTarget = detectRedirectTarget(content);
  const runtime = detectRuntime(content);

  const nodeId = randomUUID();
  const node: MiddlewareNode = {
    id: nodeId,
    type: 'middleware',
    filePath: relPath,
    label: 'Middleware',
    group: 'middleware',
    matcherPatterns: matchers,
    authProvider: authProvider || undefined,
    redirectTarget: redirectTarget || undefined,
    runtime,
  };

  // Create connectors for matched routes
  const connectors: Connector[] = [];
  for (const [routePath, routeId] of routeNodeIds) {
    if (matchesRoute(routePath, matchers)) {
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
  }

  return { node, connectors };
}

function extractMatchers(content: string): string[] {
  // Match: export const config = { matcher: [...] }
  // or: export const config = { matcher: '/dashboard/:path*' }
  const configMatch = content.match(/export\s+const\s+config\s*=\s*({[\s\S]*?});?\s*$/m);
  if (!configMatch) return ['/*']; // No config means match all routes

  const configStr = configMatch[1];

  // Extract matcher array
  const arrayMatch = configStr.match(/matcher\s*:\s*\[([\s\S]*?)\]/);
  if (arrayMatch) {
    const items = arrayMatch[1].match(/['"]([^'"]+)['"]/g);
    if (items) {
      return items.map((s) => s.replace(/^['"]|['"]$/g, ''));
    }
  }

  // Extract single matcher string
  const singleMatch = configStr.match(/matcher\s*:\s*['"]([^'"]+)['"]/);
  if (singleMatch) {
    return [singleMatch[1]];
  }

  return ['/*'];
}

function detectAuthProvider(content: string): string | null {
  if (/from\s+['"]next-auth/.test(content) || /from\s+['"]@auth\//.test(content)) {
    return 'NextAuth';
  }
  if (/from\s+['"]@clerk\/nextjs/.test(content)) {
    return 'Clerk';
  }
  if (/from\s+['"]@supabase\/ssr/.test(content) || /from\s+['"]@supabase\/auth-helpers/.test(content)) {
    return 'Supabase';
  }
  if (/from\s+['"]@kinde-oss/.test(content)) {
    return 'Kinde';
  }
  // Generic auth detection
  if (/auth|session|token/i.test(content) && /redirect|rewrite|response/i.test(content)) {
    return 'Custom';
  }
  return null;
}

function detectRedirectTarget(content: string): string | null {
  // NextResponse.redirect(new URL('/login', ...))
  const redirectMatch = content.match(/NextResponse\.redirect\(\s*new\s+URL\(\s*['"]([^'"]+)['"]/);
  if (redirectMatch) {
    return redirectMatch[1];
  }
  return null;
}

function detectRuntime(content: string): 'edge' | 'node' {
  if (/export\s+const\s+runtime\s*=\s*['"]edge['"]/.test(content)) {
    return 'edge';
  }
  // Middleware in Next.js runs on Edge by default
  return 'edge';
}

function matchesRoute(routePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === '/*') return true;

    // Convert Next.js matcher pattern to simple test
    // /dashboard/:path* → matches /dashboard and /dashboard/*
    const regexStr = pattern
      .replace(/\/:[\w]+\*/g, '(?:/.*)?') // /:path* → optional catch-all
      .replace(/:[^/]+/g, '[^/]+') // :param → [^/]+
      .replace(/\//g, '\\/'); // escape slashes

    const regex = new RegExp(`^${regexStr}(?:\\/.*)?$`);
    if (regex.test(routePath)) return true;
  }
  return false;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}
