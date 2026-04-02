import { describe, expect, it } from 'vitest';
import { validateProbeUrl } from '../src/probe/validate.js';

describe('validateProbeUrl', () => {
  // ─── Localhost (always allowed) ───
  it('allows http://localhost:3000', async () => {
    const result = await validateProbeUrl('http://localhost:3000');
    expect(result.valid).toBe(true);
  });

  it('allows http://127.0.0.1:3000', async () => {
    const result = await validateProbeUrl('http://127.0.0.1:3000');
    expect(result.valid).toBe(true);
  });

  it('allows http://[::1]:3000', async () => {
    const result = await validateProbeUrl('http://[::1]:3000');
    expect(result.valid).toBe(true);
  });

  // ─── HTTPS public (always allowed) ───
  it('allows https://example.com', async () => {
    const result = await validateProbeUrl('https://example.com');
    expect(result.valid).toBe(true);
  });

  // ─── Plain HTTP to non-localhost (blocked by default) ───
  it('blocks http://example.com by default', async () => {
    const result = await validateProbeUrl('http://example.com');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('plain HTTP');
    expect(result.reason).toContain('--allow-http');
  });

  it('allows http://example.com with allowHttp', async () => {
    const result = await validateProbeUrl('http://example.com', { allowHttp: true });
    expect(result.valid).toBe(true);
  });

  // ─── Cloud metadata (always blocked) ───
  it('blocks 169.254.169.254 (cloud metadata)', async () => {
    const result = await validateProbeUrl('http://169.254.169.254');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('link-local');
    expect(result.reason).toContain('never allowed');
  });

  it('blocks 169.254.169.254 even with allowInternal', async () => {
    const result = await validateProbeUrl('http://169.254.169.254', { allowInternal: true, allowHttp: true });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('never allowed');
  });

  // ─── Private IPs (blocked by default, allowed with flag) ───
  it('blocks 10.0.0.1 by default', async () => {
    const result = await validateProbeUrl('https://10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private');
    expect(result.reason).toContain('--allow-internal');
  });

  it('allows 10.0.0.1 with allowInternal', async () => {
    const result = await validateProbeUrl('https://10.0.0.1', { allowInternal: true });
    expect(result.valid).toBe(true);
  });

  it('blocks 172.16.0.1 by default', async () => {
    const result = await validateProbeUrl('https://172.16.0.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private');
  });

  it('allows 172.16.0.1 with allowInternal', async () => {
    const result = await validateProbeUrl('https://172.16.0.1', { allowInternal: true });
    expect(result.valid).toBe(true);
  });

  it('blocks 192.168.1.1 by default', async () => {
    const result = await validateProbeUrl('https://192.168.1.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private');
  });

  it('allows 192.168.1.1 with allowInternal', async () => {
    const result = await validateProbeUrl('https://192.168.1.1', { allowInternal: true });
    expect(result.valid).toBe(true);
  });

  // ─── CGNAT (blocked by default) ───
  it('blocks 100.64.0.1 (CGNAT) by default', async () => {
    const result = await validateProbeUrl('https://100.64.0.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('CGNAT');
  });

  it('allows 100.64.0.1 with allowInternal', async () => {
    const result = await validateProbeUrl('https://100.64.0.1', { allowInternal: true });
    expect(result.valid).toBe(true);
  });

  // ─── Reserved ranges (always blocked) ───
  it('blocks 0.0.0.0', async () => {
    const result = await validateProbeUrl('http://0.0.0.0', { allowHttp: true });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('reserved');
  });

  it('blocks 240.0.0.1 (Class E)', async () => {
    const result = await validateProbeUrl('https://240.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('reserved');
  });

  it('blocks 198.18.0.1 (benchmark)', async () => {
    const result = await validateProbeUrl('https://198.18.0.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('reserved');
  });

  it('blocks 192.0.2.1 (TEST-NET-1)', async () => {
    const result = await validateProbeUrl('https://192.0.2.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('reserved');
  });

  // ─── Edge cases ───
  it('rejects invalid URLs', async () => {
    const result = await validateProbeUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid URL');
  });

  it('allows 172.32.0.1 (outside 172.16/12 private range)', async () => {
    const result = await validateProbeUrl('https://172.32.0.1');
    expect(result.valid).toBe(true);
  });

  it('allows 100.128.0.1 (outside CGNAT range)', async () => {
    const result = await validateProbeUrl('https://100.128.0.1');
    expect(result.valid).toBe(true);
  });
});
