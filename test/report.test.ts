import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discover } from '../src/discover/index.js';
import { generateReport } from '../src/report/generator.js';

const fixtures = join(__dirname, 'fixtures');

describe('generateReport', () => {
  it('produces valid HTML with embedded data', async () => {
    const report = await discover(join(fixtures, 'nextjs-app-router'));
    const html = generateReport(report);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('shipmap');
    expect(html).toContain('test-nextjs-app');
    expect(html).toContain('nextjs');
  });

  it('contains all CSS styles inline', async () => {
    const report = await discover(join(fixtures, 'nextjs-app-router'));
    const html = generateReport(report);

    expect(html).toContain('<style>');
    expect(html).toContain('--bg:');
    expect(html).toContain('.node');
    expect(html).toContain('#canvas-container');
  });

  it('contains canvas script', async () => {
    const report = await discover(join(fixtures, 'nextjs-app-router'));
    const html = generateReport(report);

    expect(html).toContain('<script>');
    expect(html).toContain('REPORT');
    expect(html).toContain('layoutNodes');
    expect(html).toContain('drawConnectors');
  });

  it('embeds report JSON data', async () => {
    const report = await discover(join(fixtures, 'nextjs-app-router'));
    const html = generateReport(report);

    // The JSON should be embedded
    expect(html).toContain('"tool":"shipmap"');
    expect(html).toContain('"framework":"nextjs"');
  });

  it('escapes HTML in project name', async () => {
    const report = await discover(join(fixtures, 'nextjs-app-router'));
    report.meta.projectName = '<script>alert("xss")</script>';
    const html = generateReport(report);

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
