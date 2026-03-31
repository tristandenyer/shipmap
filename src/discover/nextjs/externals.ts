import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ExternalNode, Connector } from '../../types.js';

interface ExternalServicePattern {
  name: string;
  envPrefixes: string[];
  importPatterns: string[];
}

const SERVICE_PATTERNS: ExternalServicePattern[] = [
  { name: 'Stripe', envPrefixes: ['STRIPE_', 'VITE_STRIPE_'], importPatterns: ['stripe', '@stripe/stripe-js'] },
  { name: 'Supabase', envPrefixes: ['SUPABASE_', 'NEXT_PUBLIC_SUPABASE_', 'VITE_SUPABASE_'], importPatterns: ['@supabase/supabase-js', '@supabase/ssr'] },
  { name: 'Firebase', envPrefixes: ['FIREBASE_', 'NEXT_PUBLIC_FIREBASE_', 'VITE_FIREBASE_'], importPatterns: ['firebase', 'firebase-admin'] },
  { name: 'AWS', envPrefixes: ['AWS_', 'VITE_AWS_'], importPatterns: ['@aws-sdk/'] },
  { name: 'OpenAI', envPrefixes: ['OPENAI_', 'VITE_OPENAI_'], importPatterns: ['openai'] },
  { name: 'Anthropic', envPrefixes: ['ANTHROPIC_', 'VITE_ANTHROPIC_'], importPatterns: ['@anthropic-ai/sdk'] },
  { name: 'Resend', envPrefixes: ['RESEND_', 'VITE_RESEND_'], importPatterns: ['resend'] },
  { name: 'SendGrid', envPrefixes: ['SENDGRID_', 'VITE_SENDGRID_'], importPatterns: ['@sendgrid/mail'] },
  { name: 'Twilio', envPrefixes: ['TWILIO_', 'VITE_TWILIO_'], importPatterns: ['twilio'] },
  { name: 'Cloudinary', envPrefixes: ['CLOUDINARY_', 'VITE_CLOUDINARY_'], importPatterns: ['cloudinary'] },
  { name: 'Sentry', envPrefixes: ['SENTRY_', 'NEXT_PUBLIC_SENTRY_', 'VITE_SENTRY_'], importPatterns: ['@sentry/nextjs', '@sentry/node'] },
  { name: 'Redis', envPrefixes: ['REDIS_', 'VITE_REDIS_'], importPatterns: ['ioredis', 'redis', '@upstash/redis'] },
  { name: 'Clerk', envPrefixes: ['CLERK_', 'NEXT_PUBLIC_CLERK_', 'VITE_CLERK_'], importPatterns: ['@clerk/nextjs'] },
  { name: 'NextAuth', envPrefixes: ['NEXTAUTH_'], importPatterns: ['next-auth'] },
  { name: 'Prisma', envPrefixes: [], importPatterns: ['@prisma/client'] },
  { name: 'Drizzle', envPrefixes: [], importPatterns: ['drizzle-orm'] },
  { name: 'Vercel', envPrefixes: ['VERCEL_', 'VITE_VERCEL_'], importPatterns: ['@vercel/'] },
];

interface ExternalsResult {
  nodes: ExternalNode[];
  connectors: Connector[];
}

export async function discoverExternals(
  projectDir: string,
  routeFiles: Map<string, string>, // filePath → node ID
): Promise<ExternalsResult> {
  const envServices = await detectFromEnvVars(projectDir);
  const importServices = await detectFromImports(projectDir, routeFiles);

  // Merge: combine env and import detection
  const serviceMap = new Map<string, { fromEnv: boolean; fromImport: boolean; referencedBy: Set<string> }>();

  for (const service of envServices) {
    serviceMap.set(service, { fromEnv: true, fromImport: false, referencedBy: new Set() });
  }

  for (const [service, routeNodeIds] of importServices) {
    const existing = serviceMap.get(service) || { fromEnv: false, fromImport: false, referencedBy: new Set() };
    existing.fromImport = true;
    for (const id of routeNodeIds) {
      existing.referencedBy.add(id);
    }
    serviceMap.set(service, existing);
  }

  const nodes: ExternalNode[] = [];
  const connectors: Connector[] = [];

  for (const [name, info] of serviceMap) {
    const nodeId = randomUUID();
    const detectedFrom = info.fromEnv && info.fromImport ? 'both' : info.fromEnv ? 'env' : 'import';

    nodes.push({
      id: nodeId,
      type: 'external',
      name,
      label: name,
      group: 'external',
      detectedFrom,
      referencedBy: [...info.referencedBy],
    });

    // Create connectors from routes to external service
    for (const routeId of info.referencedBy) {
      connectors.push({
        source: routeId,
        target: nodeId,
        type: 'external-dependency',
        confidence: 'static',
        label: `uses ${name}`,
        style: 'dashed',
        color: 'blue',
      });
    }
  }

  return { nodes, connectors };
}

async function detectFromEnvVars(projectDir: string): Promise<Set<string>> {
  const detected = new Set<string>();
  const envFiles = ['.env', '.env.local', '.env.development'];

  for (const envFile of envFiles) {
    const envPath = join(projectDir, envFile);
    let content: string;
    try {
      content = await readFile(envPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const key = trimmed.split('=')[0]?.trim();
      if (!key) continue;

      for (const pattern of SERVICE_PATTERNS) {
        for (const prefix of pattern.envPrefixes) {
          if (key.startsWith(prefix)) {
            detected.add(pattern.name);
          }
        }
      }

      // Special: DATABASE_URL with protocol detection
      if (key === 'DATABASE_URL') {
        const value = trimmed.split('=').slice(1).join('=').trim();
        if (value.startsWith('postgresql://') || value.startsWith('postgres://')) {
          detected.add('PostgreSQL');
        } else if (value.startsWith('mysql://')) {
          detected.add('MySQL');
        } else if (value.startsWith('mongodb://') || value.startsWith('mongodb+srv://')) {
          detected.add('MongoDB');
        } else {
          detected.add('Database');
        }
      }
    }
  }

  return detected;
}

async function detectFromImports(
  projectDir: string,
  routeFiles: Map<string, string>,
): Promise<Map<string, Set<string>>> {
  const serviceRoutes = new Map<string, Set<string>>();

  for (const [filePath, nodeId] of routeFiles) {
    const fullPath = join(projectDir, filePath);
    let content: string;
    try {
      content = await readFile(fullPath, 'utf-8');
    } catch {
      continue;
    }

    for (const pattern of SERVICE_PATTERNS) {
      for (const importPattern of pattern.importPatterns) {
        // Match: from 'package' or from "package" or require('package')
        const escaped = importPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:from\\s+['"]${escaped}|require\\(['"]${escaped})`);
        if (regex.test(content)) {
          if (!serviceRoutes.has(pattern.name)) {
            serviceRoutes.set(pattern.name, new Set());
          }
          serviceRoutes.get(pattern.name)!.add(nodeId);
        }
      }
    }
  }

  return serviceRoutes;
}
