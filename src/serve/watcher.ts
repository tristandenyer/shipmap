import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { watch } from 'chokidar';
import { discover } from '../discover/index.js';
import { writeLastReport } from '../probe/cache.js';
import { probeExternals } from '../probe/external.js';
import { type ProbeOptions, probeRoutes } from '../probe/http.js';
import { generateReport } from '../report/generator.js';
import type { ExternalNode, RouteNode } from '../types.js';

interface WatchServerOptions {
  projectDir: string;
  port: number;
  probeEnabled: boolean;
  probeOptions?: ProbeOptions;
}

const SSE_SCRIPT = `
<script>
(function() {
  var es;
  function connect() {
    es = new EventSource('/events');
    es.onmessage = function(e) {
      if (e.data === 'reload') window.location.reload();
    };
    es.onerror = function() {
      es.close();
      setTimeout(connect, 1000);
    };
  }
  connect();
})();
</script>
`;

export async function startWatchServer(options: WatchServerOptions): Promise<void> {
  const { projectDir, port, probeEnabled, probeOptions } = options;
  let currentHtml = '';
  let currentJson = '';
  const sseClients: Set<ServerResponse> = new Set();

  async function rebuild() {
    try {
      const report = await discover(projectDir);

      if (probeEnabled && probeOptions) {
        report.meta.mode = 'probe';
        const routeNodes = report.nodes.filter((n): n is RouteNode => n.type === 'page' || n.type === 'api');
        const probedRoutes = await probeRoutes(routeNodes, probeOptions);
        const probedMap = new Map(probedRoutes.map((n) => [n.id, n]));
        report.nodes = report.nodes.map((n) => probedMap.get(n.id) || n);

        report.connectors = report.connectors.map((c) => {
          const sourceNode = probedMap.get(c.source);
          const targetNode = probedMap.get(c.target);
          if (sourceNode?.probe?.status !== 'not-probed' || targetNode?.probe?.status !== 'not-probed') {
            return { ...c, confidence: 'probed' as const, style: 'solid' as const };
          }
          return c;
        });

        const externalNodes = report.nodes.filter((n): n is ExternalNode => n.type === 'external');
        if (externalNodes.length > 0) {
          const probedExternals = await probeExternals(externalNodes, {
            timeout: probeOptions.timeout,
          });
          const extMap = new Map(probedExternals.map((n) => [n.id, n]));
          report.nodes = report.nodes.map((n) => extMap.get(n.id) || n);
        }
      }

      await writeLastReport(projectDir, report);
      currentJson = JSON.stringify(report, null, 2);
      const html = generateReport(report);
      // Inject SSE script before </body>
      currentHtml = html.replace('</body>', `${SSE_SCRIPT}</body>`);

      // Notify all SSE clients
      for (const client of sseClients) {
        client.write('data: reload\n\n');
      }
      console.log(`  ↻ Rebuilt at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(`  ✗ Rebuild error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Initial build
  await rebuild();

  // HTTP server
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('data: connected\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (req.url === '/api/topology') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(currentJson);
      return;
    }

    // Serve HTML for everything else
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(currentHtml);
  });

  server.listen(port, () => {
    console.log(`\n  ⚓ shipmap live at http://localhost:${port} — watching for changes...\n`);
  });

  // File watcher
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const watcher = watch(
    [
      'app/**/*',
      'pages/**/*',
      'src/**/*',
      'middleware.ts',
      'middleware.js',
      '.env.local',
      'shipmap.config.js',
      'shipmap.config.mjs',
      'next.config.js',
      'next.config.mjs',
    ],
    {
      cwd: projectDir,
      ignoreInitial: true,
      ignored: ['**/node_modules/**', '**/.next/**', '**/.shipmap/**'],
    },
  );

  watcher.on('all', (_event: string, path: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`  → File changed: ${path}`);
      rebuild();
    }, 500);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n  Shutting down...');
    watcher.close();
    for (const client of sseClients) {
      client.end();
    }
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
