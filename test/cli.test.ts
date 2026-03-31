import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';
import { createCli } from '../src/cli.js';

const fixtures = join(__dirname, 'fixtures');

describe('CLI', () => {
  const outputFiles: string[] = [];

  afterEach(async () => {
    for (const f of outputFiles) {
      try { await unlink(f); } catch {}
    }
    outputFiles.length = 0;
  });

  it('--json outputs valid JSON matching TopologyReport schema', async () => {
    const output = join(__dirname, 'tmp-cli-test.json');
    outputFiles.push(output);

    const cli = createCli();
    await cli.parseAsync([
      'node', 'shipmap',
      join(fixtures, 'nextjs-app-router'),
      '--json',
      '--output', output,
      '--quiet',
      '--no-open',
    ]);

    const raw = await readFile(output, 'utf-8');
    const report = JSON.parse(raw);

    expect(report.meta).toBeDefined();
    expect(report.meta.tool).toBe('shipmap');
    expect(report.meta.framework).toBe('nextjs');
    expect(report.nodes).toBeInstanceOf(Array);
    expect(report.connectors).toBeInstanceOf(Array);
    expect(report.groups).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.summary.totalRoutes).toBeGreaterThanOrEqual(0);
    expect(report.summary.totalApiRoutes).toBeGreaterThanOrEqual(0);
    expect(report.summary.totalExternals).toBeGreaterThanOrEqual(0);
  });

  it('--output writes HTML to specified path', async () => {
    const output = join(__dirname, 'tmp-cli-test.html');
    outputFiles.push(output);

    const cli = createCli();
    await cli.parseAsync([
      'node', 'shipmap',
      join(fixtures, 'nextjs-app-router'),
      '--output', output,
      '--quiet',
      '--no-open',
    ]);

    const html = await readFile(output, 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('shipmap');
  });

  it('--json auto-renames .html extension to .json', async () => {
    const output = join(__dirname, 'tmp-cli-rename.json');
    outputFiles.push(output);

    const cli = createCli();
    await cli.parseAsync([
      'node', 'shipmap',
      join(fixtures, 'nextjs-app-router'),
      '--json',
      '--output', join(__dirname, 'tmp-cli-rename.html'),
      '--quiet',
      '--no-open',
    ]);

    const raw = await readFile(output, 'utf-8');
    const report = JSON.parse(raw);
    expect(report.meta.tool).toBe('shipmap');
  });

  it('--help shows usage information', async () => {
    const cli = createCli();
    let helpText = '';
    cli.configureOutput({
      writeOut: (str: string) => { helpText += str; },
      writeErr: (str: string) => { helpText += str; },
    });
    cli.exitOverride();

    try {
      await cli.parseAsync(['node', 'shipmap', '--help']);
    } catch {
      // commander throws on --help with exitOverride
    }

    expect(helpText).toContain('shipmap');
    expect(helpText).toContain('--output');
    expect(helpText).toContain('--json');
    expect(helpText).toContain('--verbose');
    expect(helpText).toContain('--quiet');
  });

  it('--version shows version', async () => {
    const cli = createCli();
    let versionText = '';
    cli.configureOutput({
      writeOut: (str: string) => { versionText += str; },
      writeErr: (str: string) => { versionText += str; },
    });
    cli.exitOverride();

    try {
      await cli.parseAsync(['node', 'shipmap', '--version']);
    } catch {
      // commander throws on --version with exitOverride
    }

    expect(versionText).toContain('0.3.0');
  });

  it('--verbose includes detailed discovery output', async () => {
    const output = join(__dirname, 'tmp-cli-verbose.html');
    outputFiles.push(output);

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(' ')); };

    try {
      const cli = createCli();
      await cli.parseAsync([
        'node', 'shipmap',
        join(fixtures, 'nextjs-app-router'),
        '--output', output,
        '--verbose',
        '--no-open',
      ]);
    } finally {
      console.log = origLog;
    }

    const allOutput = logs.join('\n');
    expect(allOutput).toContain('Discovery Details');
    expect(allOutput).toContain('Connectors:');
  });

  it('errors on directory without package.json', async () => {
    const origExit = process.exit;
    const origError = console.error;
    let exitCode: number | undefined;
    let errorOutput = '';

    process.exit = ((code?: number) => { exitCode = code; throw new Error('process.exit'); }) as any;
    console.error = (...args: any[]) => { errorOutput += args.join(' '); };

    try {
      const cli = createCli();
      await cli.parseAsync([
        'node', 'shipmap',
        '/tmp/nonexistent-dir-shipmap-test',
        '--quiet',
        '--no-open',
      ]);
    } catch {
      // expected
    } finally {
      process.exit = origExit;
      console.error = origError;
    }

    expect(exitCode).toBe(1);
    expect(errorOutput).toContain('Error');
  });
});
