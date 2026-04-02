import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { archiveReport, readLastReport, readReportFromPath, writeLastReport } from '../src/probe/cache.js';

describe('report archival', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'shipmap-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const fakeReport = { meta: { tool: 'shipmap' }, nodes: [], summary: {} };

  it('writes archive to .shipmap/history/', async () => {
    await archiveReport(tempDir, fakeReport);

    const historyDir = join(tempDir, '.shipmap', 'history');
    const files = await readdir(historyDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);

    const content = JSON.parse(await readFile(join(historyDir, files[0]), 'utf-8'));
    expect(content.meta.tool).toBe('shipmap');
  });

  it('prunes old archives beyond 10', async () => {
    // Create 12 archives
    for (let i = 0; i < 12; i++) {
      await archiveReport(tempDir, { ...fakeReport, i });
      // Small delay to ensure unique timestamps
      await new Promise((r) => setTimeout(r, 10));
    }

    const historyDir = join(tempDir, '.shipmap', 'history');
    const files = await readdir(historyDir);
    expect(files.length).toBeLessThanOrEqual(10);
  });

  it('writeLastReport and readLastReport round-trip', async () => {
    await writeLastReport(tempDir, fakeReport);
    const loaded = await readLastReport(tempDir);
    expect(loaded).toEqual(fakeReport);
  });

  it('readLastReport returns null when no report exists', async () => {
    const result = await readLastReport(tempDir);
    expect(result).toBeNull();
  });

  it('readReportFromPath reads a specific file', async () => {
    const filePath = join(tempDir, 'custom-report.json');
    await writeFile(filePath, JSON.stringify(fakeReport));

    const loaded = await readReportFromPath(filePath);
    expect(loaded).toEqual(fakeReport);
  });

  it('readReportFromPath returns null for nonexistent file', async () => {
    const result = await readReportFromPath(join(tempDir, 'nope.json'));
    expect(result).toBeNull();
  });
});
