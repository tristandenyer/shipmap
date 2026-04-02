import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSnytchResults } from '../src/snytch/index.js';

const tmpDir = join(__dirname, 'tmp-snytch-test');

describe('loadSnytchResults', () => {
  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true });
    } catch {}
  });

  it('returns null when no snytch files exist', async () => {
    const result = await loadSnytchResults(tmpDir);
    expect(result).toBeNull();
  });

  it('loads findings from .snytch/scan-results.json', async () => {
    await mkdir(join(tmpDir, '.snytch'), { recursive: true });
    const findings = [
      {
        file: 'src/auth.ts',
        type: 'aws_key',
        severity: 'critical',
        line: 42,
        message: 'AWS access key found',
      },
      {
        file: 'src/api.ts',
        type: 'private_key',
        severity: 'high',
        line: 15,
        message: 'Private key detected',
      },
    ];
    await writeFile(join(tmpDir, '.snytch', 'scan-results.json'), JSON.stringify({ findings }));

    const result = await loadSnytchResults(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.totalFindings).toBe(2);
    expect(result!.findings).toHaveLength(2);
    expect(result!.findings[0].filePath).toBe('src/auth.ts');
    expect(result!.findings[0].secretType).toBe('aws_key');
    expect(result!.findings[0].severity).toBe('critical');
    expect(result!.findings[0].line).toBe(42);
  });

  it('loads findings from snytch-report.json', async () => {
    const findings = [
      {
        file: 'src/config.ts',
        type: 'database_password',
        severity: 'medium',
        message: 'Database password found',
      },
    ];
    await writeFile(join(tmpDir, 'snytch-report.json'), JSON.stringify({ findings }));

    const result = await loadSnytchResults(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.totalFindings).toBe(1);
    expect(result!.findings[0].filePath).toBe('src/config.ts');
  });

  it('maps findings to route file paths', async () => {
    const findings = [
      { file: 'src/routes/api.ts', type: 'secret', severity: 'high' },
      { file: 'src/routes/api.ts', type: 'key', severity: 'medium' },
      { file: 'src/routes/auth.ts', type: 'token', severity: 'critical' },
    ];
    await writeFile(join(tmpDir, 'snytch-report.json'), JSON.stringify({ findings }));

    const result = await loadSnytchResults(tmpDir);
    expect(result!.routeFindings.size).toBe(2);
    expect(result!.routeFindings.get('src/routes/api.ts')).toHaveLength(2);
    expect(result!.routeFindings.get('src/routes/auth.ts')).toHaveLength(1);
  });

  it('handles malformed JSON gracefully', async () => {
    await writeFile(join(tmpDir, 'snytch-report.json'), 'invalid json {{{');

    const result = await loadSnytchResults(tmpDir);
    expect(result).toBeNull();
  });

  it('handles missing findings array gracefully', async () => {
    await writeFile(join(tmpDir, 'snytch-report.json'), JSON.stringify({ data: [] }));

    const result = await loadSnytchResults(tmpDir);
    expect(result).toBeNull();
  });

  it('counts total findings correctly', async () => {
    const findings = [
      { file: 'src/a.ts', type: 't1', severity: 'high' },
      { file: 'src/b.ts', type: 't2', severity: 'medium' },
      { file: 'src/c.ts', type: 't3', severity: 'low' },
      { file: 'src/d.ts', type: 't4', severity: 'critical' },
    ];
    await writeFile(join(tmpDir, 'snytch-report.json'), JSON.stringify({ findings }));

    const result = await loadSnytchResults(tmpDir);
    expect(result!.totalFindings).toBe(4);
    expect(result!.findings).toHaveLength(4);
  });

  it('uses file field when filePath not present', async () => {
    const findings = [{ file: 'src/test.ts', type: 'secret', severity: 'high' }];
    await writeFile(join(tmpDir, 'snytch-report.json'), JSON.stringify({ findings }));

    const result = await loadSnytchResults(tmpDir);
    expect(result!.findings[0].filePath).toBe('src/test.ts');
  });

  it('defaults missing severity to medium', async () => {
    const findings = [{ file: 'src/test.ts', type: 'secret' }];
    await writeFile(join(tmpDir, 'snytch-report.json'), JSON.stringify({ findings }));

    const result = await loadSnytchResults(tmpDir);
    expect(result!.findings[0].severity).toBe('medium');
  });

  it('prefers .snytch/scan-results.json over snytch-report.json', async () => {
    await mkdir(join(tmpDir, '.snytch'), { recursive: true });

    const findings1 = [{ file: 'src/scan-results.ts', type: 'secret', severity: 'high' }];
    await writeFile(join(tmpDir, '.snytch', 'scan-results.json'), JSON.stringify({ findings: findings1 }));

    const findings2 = [{ file: 'src/report.ts', type: 'secret', severity: 'high' }];
    await writeFile(join(tmpDir, 'snytch-report.json'), JSON.stringify({ findings: findings2 }));

    const result = await loadSnytchResults(tmpDir);
    expect(result!.findings[0].filePath).toBe('src/scan-results.ts');
  });
});
