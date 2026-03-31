import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface AuthResult {
  provider: string;
  headers: Record<string, string>;
}

const ENV_FILES = ['.env.local', '.env', '.env.development'];

async function loadEnvVars(projectDir: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};
  for (const file of ENV_FILES) {
    try {
      const content = await readFile(join(projectDir, file), 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!vars[key]) vars[key] = value;
      }
    } catch {
      // File doesn't exist, skip
    }
  }
  return vars;
}

export async function detectAuth(
  projectDir: string,
): Promise<AuthResult | null> {
  const env = await loadEnvVars(projectDir);

  // NextAuth / Auth.js
  if (env.NEXTAUTH_SECRET) {
    // Generate a simple mock JWT for probe authentication
    // We use a basic base64-encoded JWT structure (not cryptographically signed for real auth,
    // but sufficient for probing routes that check for session presence)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'shipmap-probe',
      name: 'Shipmap Probe',
      email: 'probe@shipmap.dev',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    // Sign with HMAC-SHA256 using the NEXTAUTH_SECRET
    const { createHmac } = await import('node:crypto');
    const signature = createHmac('sha256', env.NEXTAUTH_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const token = `${header}.${payload}.${signature}`;

    return {
      provider: 'NextAuth',
      headers: { Cookie: `next-auth.session-token=${token}` },
    };
  }

  // Supabase
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    };
    if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      headers['apikey'] = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    return { provider: 'Supabase', headers };
  }

  // Basic Auth
  if (env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD) {
    const encoded = Buffer.from(`${env.BASIC_AUTH_USER}:${env.BASIC_AUTH_PASSWORD}`).toString('base64');
    return {
      provider: 'Basic Auth',
      headers: { Authorization: `Basic ${encoded}` },
    };
  }

  // Clerk — requires manual config, just detect and advise
  if (env.CLERK_SECRET_KEY) {
    return {
      provider: 'Clerk',
      headers: {}, // User must provide headers via shipmap.config.js
    };
  }

  return null;
}
