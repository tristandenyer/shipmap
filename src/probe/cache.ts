import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
