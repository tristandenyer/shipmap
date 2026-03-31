import { pathToFileURL } from 'node:url';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

export interface ShipmapConfig {
  probe?: {
    baseUrl?: string;
    headers?: Record<string, string>;
    exclude?: string[];
    timeout?: number;
    concurrency?: number;
  };
}

const CONFIG_FILES = ['shipmap.config.js', 'shipmap.config.mjs'];

export async function loadConfig(projectDir: string): Promise<ShipmapConfig> {
  for (const filename of CONFIG_FILES) {
    const configPath = join(projectDir, filename);
    try {
      await access(configPath, constants.R_OK);
      const fileUrl = pathToFileURL(configPath).href;
      const mod = await import(fileUrl);
      const config = mod.default ?? mod;
      validateConfig(config);
      return config;
    } catch (err: any) {
      if (err.code === 'ENOENT' || err.code === 'ERR_MODULE_NOT_FOUND') continue;
      if (err.message?.startsWith('Invalid shipmap config')) throw err;
      continue;
    }
  }
  return {};
}

function validateConfig(config: unknown): asserts config is ShipmapConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('Invalid shipmap config: must export a default object');
  }
  const c = config as any;
  if (c.probe !== undefined) {
    if (typeof c.probe !== 'object' || c.probe === null) {
      throw new Error('Invalid shipmap config: probe must be an object');
    }
    if (c.probe.baseUrl !== undefined && typeof c.probe.baseUrl !== 'string') {
      throw new Error('Invalid shipmap config: probe.baseUrl must be a string');
    }
    if (c.probe.timeout !== undefined && typeof c.probe.timeout !== 'number') {
      throw new Error('Invalid shipmap config: probe.timeout must be a number');
    }
    if (c.probe.concurrency !== undefined && typeof c.probe.concurrency !== 'number') {
      throw new Error('Invalid shipmap config: probe.concurrency must be a number');
    }
    if (c.probe.exclude !== undefined && !Array.isArray(c.probe.exclude)) {
      throw new Error('Invalid shipmap config: probe.exclude must be an array');
    }
    if (c.probe.headers !== undefined && (typeof c.probe.headers !== 'object' || c.probe.headers === null)) {
      throw new Error('Invalid shipmap config: probe.headers must be an object');
    }
  }
}
