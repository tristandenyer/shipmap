import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFramework } from '../src/detect/framework.js';

const fixtures = join(__dirname, 'fixtures');

describe('detectFramework', () => {
  it('detects Next.js from package.json', async () => {
    const result = await detectFramework(join(fixtures, 'nextjs-app-router'));
    expect(result.type).toBe('nextjs');
    expect(result.version).toBe('14.2.0');
  });

  it('detects Next.js Pages Router project', async () => {
    const result = await detectFramework(join(fixtures, 'nextjs-pages-router'));
    expect(result.type).toBe('nextjs');
    expect(result.version).toBe('13.5.0');
  });

  it('throws for missing package.json', async () => {
    await expect(detectFramework('/tmp/nonexistent-dir')).rejects.toThrow('No package.json');
  });
});
