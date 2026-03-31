import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { discover } from '../src/discover/index.js';

describe('Generic discovery', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'shipmap-generic-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('discovers routes from pages/ directory', async () => {
    // Create minimal structure
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'generic-app' }));
    await mkdir(join(tempDir, 'pages'), { recursive: true });
    await writeFile(join(tempDir, 'pages', 'index.ts'), 'export default function() {}');
    await writeFile(join(tempDir, 'pages', 'about.ts'), 'export default function() {}');

    const report = await discover(tempDir);
    expect(report.meta.framework).toBe('generic');
    const pages = report.nodes.filter(n => n.type === 'page');
    expect(pages.length).toBeGreaterThanOrEqual(1);
  });

  it('discovers API routes from api/ directory', async () => {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'generic-app' }));
    await mkdir(join(tempDir, 'api'), { recursive: true });
    await writeFile(join(tempDir, 'api', 'users.ts'), 'export function GET() {}');

    const report = await discover(tempDir);
    const apis = report.nodes.filter(n => n.type === 'api');
    expect(apis.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty project gracefully', async () => {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'empty-app' }));

    const report = await discover(tempDir);
    expect(report.meta.framework).toBe('generic');
    expect(report.nodes).toHaveLength(0);
  });
});
