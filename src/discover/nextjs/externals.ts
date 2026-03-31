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
  // Payments
  { name: 'Stripe', envPrefixes: ['STRIPE_', 'VITE_STRIPE_'], importPatterns: ['stripe', '@stripe/stripe-js'] },
  { name: 'PayPal', envPrefixes: ['PAYPAL_', 'VITE_PAYPAL_'], importPatterns: ['@paypal/react-paypal-js', '@paypal/checkout-server-sdk'] },
  { name: 'Square', envPrefixes: ['SQUARE_', 'VITE_SQUARE_'], importPatterns: ['square'] },
  { name: 'Lemon Squeezy', envPrefixes: ['LEMONSQUEEZY_', 'LEMON_SQUEEZY_'], importPatterns: ['@lemonsqueezy/lemonsqueezy.js'] },

  // Auth
  { name: 'Clerk', envPrefixes: ['CLERK_', 'NEXT_PUBLIC_CLERK_', 'VITE_CLERK_'], importPatterns: ['@clerk/nextjs', '@clerk/clerk-sdk-node'] },
  { name: 'NextAuth', envPrefixes: ['NEXTAUTH_'], importPatterns: ['next-auth'] },
  { name: 'Auth0', envPrefixes: ['AUTH0_', 'VITE_AUTH0_'], importPatterns: ['@auth0/nextjs-auth0', '@auth0/auth0-react', 'auth0'] },
  { name: 'Lucia', envPrefixes: [], importPatterns: ['lucia'] },
  { name: 'Kinde', envPrefixes: ['KINDE_'], importPatterns: ['@kinde-oss/kinde-auth-nextjs'] },

  // Databases & ORMs
  { name: 'Supabase', envPrefixes: ['SUPABASE_', 'NEXT_PUBLIC_SUPABASE_', 'VITE_SUPABASE_'], importPatterns: ['@supabase/supabase-js', '@supabase/ssr'] },
  { name: 'Firebase', envPrefixes: ['FIREBASE_', 'NEXT_PUBLIC_FIREBASE_', 'VITE_FIREBASE_'], importPatterns: ['firebase', 'firebase-admin'] },
  { name: 'Prisma', envPrefixes: [], importPatterns: ['@prisma/client'] },
  { name: 'Drizzle', envPrefixes: [], importPatterns: ['drizzle-orm'] },
  { name: 'MongoDB', envPrefixes: ['MONGODB_', 'MONGO_'], importPatterns: ['mongodb', 'mongoose'] },
  { name: 'PlanetScale', envPrefixes: ['PLANETSCALE_'], importPatterns: ['@planetscale/database'] },
  { name: 'Turso', envPrefixes: ['TURSO_'], importPatterns: ['@libsql/client'] },
  { name: 'Neon', envPrefixes: ['NEON_'], importPatterns: ['@neondatabase/serverless'] },
  { name: 'Convex', envPrefixes: ['CONVEX_', 'NEXT_PUBLIC_CONVEX_', 'VITE_CONVEX_'], importPatterns: ['convex'] },
  { name: 'FaunaDB', envPrefixes: ['FAUNA_', 'FAUNADB_'], importPatterns: ['faunadb', 'fauna'] },
  { name: 'Redis', envPrefixes: ['REDIS_', 'VITE_REDIS_', 'UPSTASH_REDIS_'], importPatterns: ['ioredis', 'redis', '@upstash/redis'] },

  // AI
  { name: 'OpenAI', envPrefixes: ['OPENAI_', 'VITE_OPENAI_'], importPatterns: ['openai'] },
  { name: 'Anthropic', envPrefixes: ['ANTHROPIC_', 'VITE_ANTHROPIC_'], importPatterns: ['@anthropic-ai/sdk'] },
  { name: 'Replicate', envPrefixes: ['REPLICATE_'], importPatterns: ['replicate'] },
  { name: 'Cohere', envPrefixes: ['COHERE_'], importPatterns: ['cohere-ai'] },
  { name: 'HuggingFace', envPrefixes: ['HUGGINGFACE_', 'HF_'], importPatterns: ['@huggingface/inference'] },
  { name: 'Groq', envPrefixes: ['GROQ_'], importPatterns: ['groq-sdk'] },
  { name: 'Mistral', envPrefixes: ['MISTRAL_'], importPatterns: ['@mistralai/mistralai'] },
  { name: 'Pinecone', envPrefixes: ['PINECONE_'], importPatterns: ['@pinecone-database/pinecone'] },

  // Email
  { name: 'Resend', envPrefixes: ['RESEND_', 'VITE_RESEND_'], importPatterns: ['resend'] },
  { name: 'SendGrid', envPrefixes: ['SENDGRID_', 'VITE_SENDGRID_'], importPatterns: ['@sendgrid/mail'] },
  { name: 'Mailgun', envPrefixes: ['MAILGUN_'], importPatterns: ['mailgun.js', 'mailgun-js'] },
  { name: 'Postmark', envPrefixes: ['POSTMARK_'], importPatterns: ['postmark'] },

  // Messaging & realtime
  { name: 'Twilio', envPrefixes: ['TWILIO_', 'VITE_TWILIO_'], importPatterns: ['twilio'] },
  { name: 'Pusher', envPrefixes: ['PUSHER_', 'NEXT_PUBLIC_PUSHER_', 'VITE_PUSHER_'], importPatterns: ['pusher', 'pusher-js'] },
  { name: 'Ably', envPrefixes: ['ABLY_', 'VITE_ABLY_'], importPatterns: ['ably'] },

  // Cloud & infra
  { name: 'AWS', envPrefixes: ['AWS_', 'VITE_AWS_'], importPatterns: ['@aws-sdk/'] },
  { name: 'Cloudinary', envPrefixes: ['CLOUDINARY_', 'VITE_CLOUDINARY_'], importPatterns: ['cloudinary'] },
  { name: 'Uploadthing', envPrefixes: ['UPLOADTHING_'], importPatterns: ['uploadthing', '@uploadthing/react'] },
  { name: 'Vercel', envPrefixes: ['VERCEL_', 'VITE_VERCEL_'], importPatterns: ['@vercel/'] },

  // Monitoring & analytics
  { name: 'Sentry', envPrefixes: ['SENTRY_', 'NEXT_PUBLIC_SENTRY_', 'VITE_SENTRY_'], importPatterns: ['@sentry/nextjs', '@sentry/node', '@sentry/browser'] },
  { name: 'Datadog', envPrefixes: ['DD_', 'DATADOG_'], importPatterns: ['dd-trace', '@datadog/browser-rum'] },
  { name: 'LogRocket', envPrefixes: ['LOGROCKET_', 'NEXT_PUBLIC_LOGROCKET_'], importPatterns: ['logrocket'] },
  { name: 'PostHog', envPrefixes: ['POSTHOG_', 'NEXT_PUBLIC_POSTHOG_', 'VITE_POSTHOG_'], importPatterns: ['posthog-js', 'posthog-node'] },

  // Search
  { name: 'Algolia', envPrefixes: ['ALGOLIA_', 'NEXT_PUBLIC_ALGOLIA_', 'VITE_ALGOLIA_'], importPatterns: ['algoliasearch', 'react-instantsearch'] },
  { name: 'Meilisearch', envPrefixes: ['MEILISEARCH_', 'MEILI_'], importPatterns: ['meilisearch'] },

  // CMS
  { name: 'Sanity', envPrefixes: ['SANITY_', 'NEXT_PUBLIC_SANITY_', 'VITE_SANITY_'], importPatterns: ['@sanity/client', 'next-sanity'] },
  { name: 'Contentful', envPrefixes: ['CONTENTFUL_', 'VITE_CONTENTFUL_'], importPatterns: ['contentful'] },
  { name: 'Strapi', envPrefixes: ['STRAPI_', 'VITE_STRAPI_'], importPatterns: ['@strapi/strapi'] },

  // APIs
  { name: 'GitHub API', envPrefixes: ['GITHUB_TOKEN', 'GITHUB_API_'], importPatterns: ['@octokit/rest', 'octokit'] },
  { name: 'Slack', envPrefixes: ['SLACK_'], importPatterns: ['@slack/web-api', '@slack/bolt'] },
  { name: 'Discord', envPrefixes: ['DISCORD_'], importPatterns: ['discord.js'] },
];

export { SERVICE_PATTERNS };
export type { ExternalServicePattern };

interface ExternalsResult {
  nodes: ExternalNode[];
  connectors: Connector[];
}

export async function discoverExternals(
  projectDir: string,
  routeFiles: Map<string, string>, // filePath → node ID
  extraPatterns?: ExternalServicePattern[],
): Promise<ExternalsResult> {
  const patterns = extraPatterns?.length ? [...SERVICE_PATTERNS, ...extraPatterns] : SERVICE_PATTERNS;
  const envServices = await detectFromEnvVars(projectDir, patterns);
  const importServices = await detectFromImports(projectDir, routeFiles, patterns);

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

async function detectFromEnvVars(projectDir: string, patterns: ExternalServicePattern[]): Promise<Set<string>> {
  const detected = new Set<string>();
  // Auto-glob all .env* files
  let envFiles: string[] = [];
  try {
    const entries = await readdir(projectDir);
    envFiles = entries.filter((f) => f === '.env' || f.startsWith('.env.'));
  } catch {
    // directory unreadable
  }

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

      for (const p of patterns) {
        for (const prefix of p.envPrefixes) {
          if (key.startsWith(prefix)) {
            detected.add(p.name);
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
  patterns: ExternalServicePattern[],
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

    for (const p of patterns) {
      for (const importPattern of p.importPatterns) {
        // Match: from 'package' or from "package" or require('package')
        const escaped = importPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:from\\s+['"]${escaped}|require\\(['"]${escaped})`);
        if (regex.test(content)) {
          if (!serviceRoutes.has(p.name)) {
            serviceRoutes.set(p.name, new Set());
          }
          serviceRoutes.get(p.name)!.add(nodeId);
        }
      }
    }
  }

  return serviceRoutes;
}
