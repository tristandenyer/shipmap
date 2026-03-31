import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { discoverExternals } from '../src/discover/nextjs/externals.js';

const fixtures = join(__dirname, 'fixtures');

describe('discoverExternals', () => {
  it('detects services from env vars', async () => {
    const routeFiles = new Map<string, string>();
    const result = await discoverExternals(join(fixtures, 'nextjs-app-router'), routeFiles);
    const names = result.nodes.map(n => n.name);
    expect(names).toContain('Supabase');
    expect(names).toContain('Stripe');
    expect(names).toContain('PostgreSQL');
  });

  it('detects services from imports', async () => {
    const routeFiles = new Map([
      ['app/api/users/route.ts', 'users-route-id'],
    ]);
    const result = await discoverExternals(join(fixtures, 'nextjs-app-router'), routeFiles);
    const supabase = result.nodes.find(n => n.name === 'Supabase');
    expect(supabase).toBeTruthy();
    expect(supabase!.detectedFrom).toBe('both'); // env + import
  });

  it('creates connectors from routes to externals', async () => {
    const routeFiles = new Map([
      ['app/api/users/route.ts', 'users-route-id'],
    ]);
    const result = await discoverExternals(join(fixtures, 'nextjs-app-router'), routeFiles);
    const supabaseNode = result.nodes.find(n => n.name === 'Supabase');
    if (supabaseNode) {
      const conn = result.connectors.find(
        c => c.target === supabaseNode.id && c.source === 'users-route-id',
      );
      expect(conn).toBeTruthy();
      expect(conn!.type).toBe('external-dependency');
    }
  });

  it('returns empty for project without env/imports', async () => {
    const result = await discoverExternals(join(fixtures, 'nextjs-pages-router'), new Map());
    expect(result.nodes.length).toBe(0);
    expect(result.connectors.length).toBe(0);
  });

  it('all external nodes have type external', async () => {
    const result = await discoverExternals(join(fixtures, 'nextjs-app-router'), new Map());
    for (const node of result.nodes) {
      expect(node.type).toBe('external');
      expect(node.group).toBe('external');
    }
  });
});
