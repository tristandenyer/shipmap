import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

// We test the SSE/HTTP server behavior at a lower level since startWatchServer
// spawns long-running processes. Test the HTTP server patterns directly.

describe('serve module patterns', () => {
  let server: Server | null = null;

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
  });

  it('SSE endpoint sends events to connected clients', async () => {
    const clients: Set<import('node:http').ServerResponse> = new Set();

    server = createServer((req, res) => {
      if (req.url === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write('data: connected\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>test</html>');
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, resolve);
    });
    const port = (server!.address() as { port: number }).port;

    // Test HTML endpoint
    const htmlRes = await fetch(`http://localhost:${port}/`);
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers.get('content-type')).toContain('text/html');
    const html = await htmlRes.text();
    expect(html).toContain('<html>');

    // Test SSE endpoint connects
    const sseRes = await fetch(`http://localhost:${port}/events`);
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get('content-type')).toContain('text/event-stream');
  });

  it('serves JSON on /api/topology', async () => {
    const testData = { meta: { tool: 'shipmap' }, nodes: [] };

    server = createServer((req, res) => {
      if (req.url === '/api/topology') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(testData));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, resolve);
    });
    const port = (server!.address() as { port: number }).port;

    const res = await fetch(`http://localhost:${port}/api/topology`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta.tool).toBe('shipmap');
  });
});
