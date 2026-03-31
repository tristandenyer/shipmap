import { pathToFileURL } from 'node:url';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

export interface ExternalServiceConfig {
  name: string;
  envPrefixes?: string[];
  importPatterns?: string[];
}

export interface ShipmapConfig {
  probe?: {
    baseUrl?: string;
    headers?: Record<string, string>;
    exclude?: string[];
    timeout?: number;
    concurrency?: number;
  };

  discovery?: {
    exclude?: string[];
    include?: string[];
  };

  externals?: ExternalServiceConfig[];

  groups?: Record<string, string | string[]>;

  ci?: {
    failOn?: string[];
    slowThreshold?: number;
    allowUnprotected?: string[];
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

  // Validate probe
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

  // Validate discovery
  if (c.discovery !== undefined) {
    if (typeof c.discovery !== 'object' || c.discovery === null) {
      throw new Error('Invalid shipmap config: discovery must be an object');
    }
    if (c.discovery.exclude !== undefined && !Array.isArray(c.discovery.exclude)) {
      throw new Error('Invalid shipmap config: discovery.exclude must be an array');
    }
    if (c.discovery.include !== undefined && !Array.isArray(c.discovery.include)) {
      throw new Error('Invalid shipmap config: discovery.include must be an array');
    }
  }

  // Validate externals
  if (c.externals !== undefined) {
    if (!Array.isArray(c.externals)) {
      throw new Error('Invalid shipmap config: externals must be an array');
    }
    for (const ext of c.externals) {
      if (typeof ext !== 'object' || ext === null || typeof ext.name !== 'string') {
        throw new Error('Invalid shipmap config: each external must be an object with a name string');
      }
      if (ext.envPrefixes !== undefined && !Array.isArray(ext.envPrefixes)) {
        throw new Error('Invalid shipmap config: externals[].envPrefixes must be an array');
      }
      if (ext.importPatterns !== undefined && !Array.isArray(ext.importPatterns)) {
        throw new Error('Invalid shipmap config: externals[].importPatterns must be an array');
      }
    }
  }

  // Validate groups
  if (c.groups !== undefined) {
    if (typeof c.groups !== 'object' || c.groups === null) {
      throw new Error('Invalid shipmap config: groups must be an object');
    }
    for (const [, value] of Object.entries(c.groups)) {
      if (typeof value !== 'string' && !Array.isArray(value)) {
        throw new Error('Invalid shipmap config: groups values must be strings or arrays');
      }
      if (Array.isArray(value) && !value.every((v) => typeof v === 'string')) {
        throw new Error('Invalid shipmap config: groups array values must contain only strings');
      }
    }
  }

  // Validate ci
  if (c.ci !== undefined) {
    if (typeof c.ci !== 'object' || c.ci === null) {
      throw new Error('Invalid shipmap config: ci must be an object');
    }
    if (c.ci.failOn !== undefined && !Array.isArray(c.ci.failOn)) {
      throw new Error('Invalid shipmap config: ci.failOn must be an array');
    }
    if (c.ci.slowThreshold !== undefined && typeof c.ci.slowThreshold !== 'number') {
      throw new Error('Invalid shipmap config: ci.slowThreshold must be a number');
    }
    if (c.ci.allowUnprotected !== undefined && !Array.isArray(c.ci.allowUnprotected)) {
      throw new Error('Invalid shipmap config: ci.allowUnprotected must be an array');
    }
  }
}
