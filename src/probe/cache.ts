import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProbeCache {
  probeUrl: string;
  probedAt: string;
  routes: Record<string, {
    status: number;
    responseTime: number;
    probedAt: string;
  }>;
}

const SHIPMAP_DIR = '.shipmap';
const CACHE_FILE = 'probe-cache.json';
const REPORT_FILE = 'last-report.json';
const HISTORY_DIR = 'history';
const MAX_HISTORY = 10;

function shipmapDir(projectDir: string): string {
  return join(projectDir, SHIPMAP_DIR);
}

async function ensureDir(projectDir: string): Promise<void> {
  await mkdir(shipmapDir(projectDir), { recursive: true });
}

export async function readProbeCache(projectDir: string): Promise<ProbeCache | null> {
  try {
    const raw = await readFile(join(shipmapDir(projectDir), CACHE_FILE), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeProbeCache(projectDir: string, cache: ProbeCache): Promise<void> {
  await ensureDir(projectDir);
  await writeFile(
    join(shipmapDir(projectDir), CACHE_FILE),
    JSON.stringify(cache, null, 2),
  );
}

export async function writeLastReport(projectDir: string, report: unknown): Promise<void> {
  await ensureDir(projectDir);
  await writeFile(
    join(shipmapDir(projectDir), REPORT_FILE),
    JSON.stringify(report, null, 2),
  );
}

export async function readLastReport(projectDir: string): Promise<unknown | null> {
  try {
    const raw = await readFile(join(shipmapDir(projectDir), REPORT_FILE), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readReportFromPath(filePath: string): Promise<unknown | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function archiveReport(projectDir: string, report: unknown): Promise<void> {
  const historyDir = join(shipmapDir(projectDir), HISTORY_DIR);
  await mkdir(historyDir, { recursive: true });

  // Create timestamped filename
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
  await writeFile(
    join(historyDir, `${timestamp}.json`),
    JSON.stringify(report, null, 2),
  );

  // Prune old reports beyond MAX_HISTORY
  try {
    const files = await readdir(historyDir);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
    if (jsonFiles.length > MAX_HISTORY) {
      const toDelete = jsonFiles.slice(0, jsonFiles.length - MAX_HISTORY);
      for (const f of toDelete) {
        await unlink(join(historyDir, f));
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
