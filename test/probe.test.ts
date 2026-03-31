import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { probeRoutes } from '../src/probe/http.js';
import type { RouteNode } from '../src/types.js';

let server: Server;
let port: number;

function makeNode(path: string, type: 'page' | 'api' = 'page', methods?: string[]): RouteNode {
  return {
    id: path,
    type,
    path,
    filePath: `app${path}/page.tsx`,
    group: 'root',
    label: path,
    methods: methods as any,
  };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/ok') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('OK');
    } else if (req.url === '/error') {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error');
    } else if (req.url === '/not-found') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else if (req.url === '/slow') {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Slow');
      }, 100); // Not actually 2s+ for test speed; we test classification separately
    } else if (req.url === '/api/users') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
      } else if (req.method === 'POST') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end('{}');
      } else {
        res.writeHead(405);
        res.end();
      }
    } else if (req.url === '/redirect') {
      res.writeHead(301, { Location: '/ok' });
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      port = (server.address() as any).port;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

describe('probeRoutes', () => {
  it('probes a page route with 200 OK', async () => {
    const nodes = [makeNode('/ok')];
    const result = await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 5000,
      concurrency: 5,
    });
    expect(result).toHaveLength(1);
    expect(result[0].probe?.status).toBe('ok');
    expect(result[0].probe?.httpStatus).toBe(200);
    expect(result[0].probe?.responseTime).toBeGreaterThanOrEqual(0);
    expect(result[0].probe?.probedAt).toBeDefined();
  });

  it('classifies 500 as error', async () => {
    const nodes = [makeNode('/error')];
    const result = await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 5000,
      concurrency: 5,
    });
    expect(result[0].probe?.status).toBe('error');
    expect(result[0].probe?.httpStatus).toBe(500);
  });

  it('classifies 404 as error', async () => {
    const nodes = [makeNode('/not-found')];
    const result = await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 5000,
      concurrency: 5,
    });
    expect(result[0].probe?.status).toBe('error');
    expect(result[0].probe?.httpStatus).toBe(404);
  });

  it('handles redirects as ok', async () => {
    const nodes = [makeNode('/redirect')];
    const result = await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 5000,
      concurrency: 5,
    });
    expect(result[0].probe?.status).toBe('ok');
    expect(result[0].probe?.httpStatus).toBe(200); // followed redirect
  });

  it('handles connection refused gracefully', async () => {
    const nodes = [makeNode('/ok')];
    const result = await probeRoutes(nodes, {
      baseUrl: 'http://localhost:1', // no server on port 1
      timeout: 2000,
      concurrency: 5,
    });
    expect(result[0].probe?.status).toBe('error');
    expect(result[0].probe?.httpStatus).toBe(0);
  });

  it('handles timeout gracefully', async () => {
    const nodes = [makeNode('/slow')];
    const result = await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 1, // 1ms timeout — will definitely timeout
      concurrency: 5,
    });
    expect(result[0].probe?.status).toBe('error');
  });

  it('respects exclude patterns', async () => {
    const nodes = [makeNode('/ok'), makeNode('/api/users', 'api', ['GET'])];
    const result = await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 5000,
      concurrency: 5,
      exclude: ['/api/*'],
    });
    expect(result[0].probe?.status).toBe('ok');
    expect(result[1].probe?.status).toBe('not-probed');
  });

  it('probes API routes with multiple methods', async () => {
    const nodes = [makeNode('/api/users', 'api', ['GET', 'POST'])];
    const result = await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 5000,
      concurrency: 5,
    });
    expect(result[0].probe?.methodResults).toBeDefined();
    expect(result[0].probe?.methodResults?.GET?.httpStatus).toBe(200);
    expect(result[0].probe?.methodResults?.POST?.httpStatus).toBe(201);
  });

  it('respects concurrency limit', async () => {
    const nodes = Array.from({ length: 10 }, () => makeNode('/ok'));
    // Just verify it doesn't crash with concurrency=1
    const result = await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 5000,
      concurrency: 1,
    });
    expect(result).toHaveLength(10);
    expect(result.every((n) => n.probe?.status === 'ok')).toBe(true);
  });

  it('calls onProgress callback', async () => {
    const nodes = [makeNode('/ok')];
    let called = false;
    await probeRoutes(nodes, {
      baseUrl: `http://localhost:${port}`,
      timeout: 5000,
      concurrency: 5,
      onProgress: () => { called = true; },
    });
    expect(called).toBe(true);
  });
});
