import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FrameworkType } from '../types.js';

export interface FrameworkDetectionResult {
  type: FrameworkType;
  version?: string;
}

export async function detectFramework(projectDir: string): Promise<FrameworkDetectionResult> {
  const pkgPath = join(projectDir, 'package.json');

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    const raw = await readFile(pkgPath, 'utf-8');
    pkg = JSON.parse(raw);
  } catch {
    throw new Error(`No package.json found in ${projectDir}. Are you in a project directory?`);
  }

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Priority order: most specific first
  if (allDeps.next) {
    return { type: 'nextjs', version: cleanVersion(allDeps.next) };
  }

  if (allDeps.vite && allDeps['@vitejs/plugin-react']) {
    return { type: 'vite-react', version: cleanVersion(allDeps.vite) };
  }

  if (allDeps['@remix-run/react'] || allDeps.remix) {
    return {
      type: 'remix',
      version: cleanVersion(allDeps['@remix-run/react'] || allDeps.remix),
    };
  }

  if (allDeps.nuxt) {
    return { type: 'nuxt', version: cleanVersion(allDeps.nuxt) };
  }

  if (allDeps['@sveltejs/kit']) {
    return { type: 'sveltekit', version: cleanVersion(allDeps['@sveltejs/kit']) };
  }

  if (allDeps.astro) {
    return { type: 'astro', version: cleanVersion(allDeps.astro) };
  }

  if (allDeps['react-router-dom'] && !allDeps.next && !allDeps['@remix-run/react']) {
    return { type: 'react-router-spa', version: cleanVersion(allDeps['react-router-dom']) };
  }

  return { type: 'generic' };
}

function cleanVersion(version: string | undefined): string | undefined {
  if (!version) return undefined;
  return version.replace(/^[\^~>=<]+/, '');
}
