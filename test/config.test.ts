import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

let counter = 0;
function tmpDir() {
  return join(__dirname, `tmp-config-test-${++counter}-${Date.now()}`);
}

describe('loadConfig', () => {
  const dirs: string[] = [];

  async function setup(content: string, dir?: string) {
    const d = dir || tmpDir();
    dirs.push(d);
    await mkdir(d, { recursive: true });
    await writeFile(join(d, 'shipmap.config.mjs'), content);
    await writeFile(join(d, 'package.json'), '{"name":"test"}');
    return d;
  }

  async function cleanup() {
    for (const d of dirs) {
      try {
        await rm(d, { recursive: true });
      } catch {}
    }
    dirs.length = 0;
  }

  it('returns empty config when no config file exists', async () => {
    const config = await loadConfig('/tmp/nonexistent-config-dir');
    expect(config).toEqual({});
  });

  it('loads ESM config file', async () => {
    const d = await setup('export default { probe: { baseUrl: "http://test:4000", timeout: 5000 } }');
    try {
      const config = await loadConfig(d);
      expect(config.probe?.baseUrl).toBe('http://test:4000');
      expect(config.probe?.timeout).toBe(5000);
    } finally {
      await cleanup();
    }
  });

  it('validates config structure', async () => {
    const d = await setup('export default { probe: { timeout: "not-a-number" } }');
    try {
      await expect(loadConfig(d)).rejects.toThrow('Invalid shipmap config');
    } finally {
      await cleanup();
    }
  });

  it('validates probe.exclude is an array', async () => {
    const d = await setup('export default { probe: { exclude: "not-array" } }');
    try {
      await expect(loadConfig(d)).rejects.toThrow('probe.exclude must be an array');
    } finally {
      await cleanup();
    }
  });

  it('prefers shipmap.config.ts when present and loadable', async () => {
    const d = tmpDir();
    dirs.push(d);
    await mkdir(d, { recursive: true });
    // Write a .ts file that is actually valid JS (tests run under a TS-aware loader via vitest)
    await writeFile(join(d, 'shipmap.config.ts'), 'export default { probe: { baseUrl: "http://ts-config:5000" } };');
    await writeFile(join(d, 'shipmap.config.mjs'), 'export default { probe: { baseUrl: "http://mjs-config:6000" } };');
    try {
      const config = await loadConfig(d);
      expect(config.probe?.baseUrl).toBe('http://ts-config:5000');
    } finally {
      await cleanup();
    }
  });
});
