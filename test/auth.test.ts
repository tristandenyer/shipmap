import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { detectAuth } from '../src/probe/auth.js';

const tmpDir = join(__dirname, 'tmp-auth-test');

describe('detectAuth', () => {
  async function setup(envContent: string) {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(join(tmpDir, '.env.local'), envContent);
  }

  async function cleanup() {
    try { await rm(tmpDir, { recursive: true }); } catch {}
  }

  it('returns null when no env files exist', async () => {
    const result = await detectAuth('/tmp/nonexistent-auth-dir');
    expect(result).toBeNull();
  });

  it('detects NextAuth from NEXTAUTH_SECRET', async () => {
    await setup('NEXTAUTH_SECRET=test-secret-key-123');
    try {
      const result = await detectAuth(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('NextAuth');
      expect(result!.headers.Cookie).toContain('next-auth.session-token=');
      // Ensure the actual secret value is NOT in the cookie (it's signed, not raw)
      expect(result!.headers.Cookie).not.toContain('test-secret-key-123');
    } finally {
      await cleanup();
    }
  });

  it('detects Supabase from env vars', async () => {
    await setup('SUPABASE_SERVICE_ROLE_KEY=srk-123\nNEXT_PUBLIC_SUPABASE_ANON_KEY=anon-456');
    try {
      const result = await detectAuth(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('Supabase');
      expect(result!.headers.Authorization).toBe('Bearer srk-123');
      expect(result!.headers.apikey).toBe('anon-456');
    } finally {
      await cleanup();
    }
  });

  it('detects Basic Auth from env vars', async () => {
    await setup('BASIC_AUTH_USER=admin\nBASIC_AUTH_PASSWORD=secret');
    try {
      const result = await detectAuth(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('Basic Auth');
      const expected = Buffer.from('admin:secret').toString('base64');
      expect(result!.headers.Authorization).toBe(`Basic ${expected}`);
    } finally {
      await cleanup();
    }
  });

  it('detects Clerk but returns empty headers', async () => {
    await setup('CLERK_SECRET_KEY=sk_test_xxx');
    try {
      const result = await detectAuth(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('Clerk');
      expect(Object.keys(result!.headers)).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it('handles quoted env values', async () => {
    await setup('BASIC_AUTH_USER="admin"\nBASIC_AUTH_PASSWORD=\'secret\'');
    try {
      const result = await detectAuth(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('Basic Auth');
    } finally {
      await cleanup();
    }
  });
});
