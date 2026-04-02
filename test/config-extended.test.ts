import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('ShipmapConfig extended fields', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(__dirname, `tmp-config-test-${Date.now()}-${Math.random()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true });
    } catch {}
  });

  it('loads discovery exclude patterns from config', async () => {
    const configCode = `
export default {
  discovery: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    include: ['src/**'],
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    const loaded = await loadConfig(tmpDir);
    expect(loaded.discovery?.exclude).toEqual(['**/node_modules/**', '**/dist/**']);
    expect(loaded.discovery?.include).toEqual(['src/**']);
  });

  it('loads custom groups mapping', async () => {
    const configCode = `
export default {
  groups: {
    'api/*': 'API Routes',
    'auth/*': ['Authentication', 'Security'],
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    const loaded = await loadConfig(tmpDir);
    expect(loaded.groups?.['api/*']).toBe('API Routes');
    expect(loaded.groups?.['auth/*']).toEqual(['Authentication', 'Security']);
  });

  it('loads CI configuration', async () => {
    const configCode = `
export default {
  ci: {
    failOn: ['high', 'critical'],
    slowThreshold: 3000,
    allowUnprotected: ['/health', '/status'],
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    const loaded = await loadConfig(tmpDir);
    expect(loaded.ci?.failOn).toEqual(['high', 'critical']);
    expect(loaded.ci?.slowThreshold).toBe(3000);
    expect(loaded.ci?.allowUnprotected).toEqual(['/health', '/status']);
  });

  it('validates all new config sections correctly', async () => {
    const configCode = `
export default {
  discovery: {
    exclude: ['**/node_modules/**'],
    include: ['src/**'],
  },
  groups: {
    'api/*': 'API',
  },
  ci: {
    failOn: ['critical'],
    slowThreshold: 2000,
    allowUnprotected: ['/health'],
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    const loaded = await loadConfig(tmpDir);
    expect(loaded.discovery).toBeDefined();
    expect(loaded.groups).toBeDefined();
    expect(loaded.ci).toBeDefined();
  });

  it('throws error when discovery.exclude is not an array', async () => {
    const configCode = `
export default {
  discovery: {
    exclude: 'not-an-array',
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    await expect(loadConfig(tmpDir)).rejects.toThrow('Invalid shipmap config: discovery.exclude must be an array');
  });

  it('throws error when discovery is not an object', async () => {
    const configCode = `
export default {
  discovery: 'invalid',
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    await expect(loadConfig(tmpDir)).rejects.toThrow('Invalid shipmap config: discovery must be an object');
  });

  it('throws error when groups values are invalid', async () => {
    const configCode = `
export default {
  groups: {
    'api/*': 123,
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    await expect(loadConfig(tmpDir)).rejects.toThrow('Invalid shipmap config: groups values must be strings or arrays');
  });

  it('throws error when groups array contains non-strings', async () => {
    const configCode = `
export default {
  groups: {
    'api/*': ['API', 123],
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    await expect(loadConfig(tmpDir)).rejects.toThrow(
      'Invalid shipmap config: groups array values must contain only strings',
    );
  });

  it('throws error when ci.failOn is not an array', async () => {
    const configCode = `
export default {
  ci: {
    failOn: 'critical',
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    await expect(loadConfig(tmpDir)).rejects.toThrow('Invalid shipmap config: ci.failOn must be an array');
  });

  it('throws error when ci.slowThreshold is not a number', async () => {
    const configCode = `
export default {
  ci: {
    slowThreshold: 'not-a-number',
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    await expect(loadConfig(tmpDir)).rejects.toThrow('Invalid shipmap config: ci.slowThreshold must be a number');
  });

  it('throws error when ci.allowUnprotected is not an array', async () => {
    const configCode = `
export default {
  ci: {
    allowUnprotected: '/health',
  },
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    await expect(loadConfig(tmpDir)).rejects.toThrow('Invalid shipmap config: ci.allowUnprotected must be an array');
  });

  it('throws error when ci is not an object', async () => {
    const configCode = `
export default {
  ci: 'invalid',
};
`;
    await writeFile(join(tmpDir, 'shipmap.config.js'), configCode);
    await expect(loadConfig(tmpDir)).rejects.toThrow('Invalid shipmap config: ci must be an object');
  });
});
