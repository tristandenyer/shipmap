import { Command } from 'commander';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { discover } from './discover/index.js';
import { generateReport } from './report/generator.js';
import { loadConfig } from './config.js';
import { detectAuth } from './probe/auth.js';
import { probeRoutes } from './probe/http.js';
import { probeExternals } from './probe/external.js';
import { writeProbeCache, writeLastReport, readLastReport, readReportFromPath, archiveReport } from './probe/cache.js';
import { compareTopology } from './diff/compare.js';
import { generateMarkdown } from './diff/markdown.js';
import { evaluateCi, formatCiOutput } from './ci/runner.js';
import type { TopologyReport, RouteNode, ExternalNode } from './types.js';
import type { CiFailRule } from './ci/runner.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('shipmap')
    .description('Map it before you ship it. Generate an interactive topology map of your project.')
    .version('0.4.0');

  program
    .argument('[directory]', 'Project directory to scan', '.')
    .option('-o, --output <path>', 'Output file path', 'shipmap-report.html')
    .option('--json', 'Output raw JSON instead of HTML')
    .option('--no-open', 'Do not open the report in the browser')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('--verbose', 'Show detailed discovery output')
    .option('--probe', 'Enable HTTP probing of discovered routes')
    .option('--probe-url <url>', 'Base URL to probe', 'http://localhost:3000')
    .option('--probe-timeout <ms>', 'Request timeout per route in ms', '10000')
    .option('--probe-concurrency <n>', 'Max concurrent probe requests', '5')
    .option('--serve [port]', 'Start live server with auto-refresh')
    .option('--diff', 'Compare to previous run and highlight changes')
    .option('--diff-from <path>', 'Compare to a specific previous report JSON')
    .option('--markdown', 'Output topology as Markdown table')
    .option('--ci', 'Exit with non-zero code on failures')
    .option('--ci-fail-on <rules>', 'Comma-separated failure rules (default: "errors")', 'errors')
    .action(async (directory: string, options: {
      output: string;
      json?: boolean;
      open: boolean;
      quiet?: boolean;
      verbose?: boolean;
      probe?: boolean;
      probeUrl: string;
      probeTimeout: string;
      probeConcurrency: string;
      serve?: string | boolean;
      diff?: boolean;
      diffFrom?: string;
      markdown?: boolean;
      ci?: boolean;
      ciFailOn: string;
    }) => {
      const projectDir = resolve(directory);
      const log = options.quiet ? (() => {}) : console.log;

      log('\n  ⚓ shipmap v0.4.0 — Map it before you ship it\n');

      try {
        // Load config file
        const config = await loadConfig(projectDir);
        const probeConfig = config.probe || {};

        // Merge config with CLI flags (CLI takes precedence)
        const probeUrl = options.probeUrl !== 'http://localhost:3000'
          ? options.probeUrl
          : (probeConfig.baseUrl || 'http://localhost:3000');
        const probeTimeout = options.probeTimeout !== '10000'
          ? parseInt(options.probeTimeout, 10)
          : (probeConfig.timeout || 10000);
        const probeConcurrency = options.probeConcurrency !== '5'
          ? parseInt(options.probeConcurrency, 10)
          : (probeConfig.concurrency || 5);
        const probeExclude = probeConfig.exclude || [];

        log('  Detecting framework...');
        const report = await discover(projectDir, {
          customExternals: config.externals,
        });

        log(`  Framework: ${report.meta.framework}${report.meta.frameworkVersion ? ` v${report.meta.frameworkVersion}` : ''}`);
        log(`  Found: ${report.summary.totalRoutes} pages, ${report.summary.totalApiRoutes} API routes, ${report.summary.totalExternals} external services`);
        if (report.summary.totalMiddleware > 0) {
          log(`  Middleware: ${report.summary.protectedRoutes} routes covered`);
        }

        // Probe mode
        if (options.probe) {
          report.meta.mode = 'probe';

          // Detect auth
          let probeHeaders: Record<string, string> = {};
          if (probeConfig.headers) {
            probeHeaders = { ...probeConfig.headers };
            log('  Auth: Using headers from shipmap.config.js');
          } else {
            const auth = await detectAuth(projectDir);
            if (auth) {
              if (auth.provider === 'Clerk' && Object.keys(auth.headers).length === 0) {
                log(`  Auth: ${auth.provider} detected — add probe.headers to shipmap.config.js with a valid JWT`);
              } else {
                probeHeaders = auth.headers;
                log(`  Auth: ${auth.provider} detected (session token generated)`);
              }
            }
          }

          log(`  Base URL: ${probeUrl}`);

          // Probe routes
          const routeNodes = report.nodes.filter(
            (n): n is RouteNode => n.type === 'page' || n.type === 'api',
          );

          log('');
          const probedRoutes = await probeRoutes(routeNodes, {
            baseUrl: probeUrl,
            timeout: probeTimeout,
            concurrency: probeConcurrency,
            headers: probeHeaders,
            exclude: probeExclude,
            onProgress: (current, total, path, status, time) => {
              if (!options.quiet) {
                const statusText = status === 0 ? 'TIMEOUT' : `${status}`;
                process.stdout.write(`\r  Probing... [${current}/${total}] ${path} (${statusText}, ${time}ms)    `);
              }
            },
          });
          if (!options.quiet) process.stdout.write('\r' + ' '.repeat(80) + '\r');

          // Replace route nodes with probed versions
          const probedMap = new Map(probedRoutes.map((n) => [n.id, n]));
          report.nodes = report.nodes.map((n) => probedMap.get(n.id) || n);

          // Update connectors: probed routes get solid connectors
          report.connectors = report.connectors.map((c) => {
            const sourceNode = probedMap.get(c.source);
            const targetNode = probedMap.get(c.target);
            if (sourceNode?.probe?.status !== 'not-probed' || targetNode?.probe?.status !== 'not-probed') {
              return { ...c, confidence: 'probed' as const, style: 'solid' as const };
            }
            return c;
          });

          // Summarize probe results
          const ok = probedRoutes.filter((n) => n.probe?.status === 'ok').length;
          const slow = probedRoutes.filter((n) => n.probe?.status === 'slow').length;
          const errors = probedRoutes.filter((n) => n.probe?.status === 'error').length;
          const notProbed = probedRoutes.filter((n) => n.probe?.status === 'not-probed').length;
          report.summary.errors = errors;

          log(`  ✓ ${ok} OK`);
          if (slow > 0) log(`  ⚠ ${slow} slow (>2s)`);
          if (errors > 0) log(`  ✗ ${errors} errors`);
          if (notProbed > 0) log(`  ○ ${notProbed} not probed (excluded)`);

          // Probe externals
          const externalNodes = report.nodes.filter(
            (n): n is ExternalNode => n.type === 'external',
          );
          if (externalNodes.length > 0) {
            log('\n  Probing external services...');
            const probedExternals = await probeExternals(externalNodes, {
              timeout: probeTimeout,
            });
            const extMap = new Map(probedExternals.map((n) => [n.id, n]));
            report.nodes = report.nodes.map((n) => extMap.get(n.id) || n);

            for (const ext of probedExternals) {
              if (!ext.host) {
                log(`  ? ${ext.name}: host unknown`);
              } else if (ext.probe?.reachable) {
                log(`  ✓ ${ext.name}: host reachable (${ext.probe.latency}ms)`);
              } else {
                log(`  ✗ ${ext.name}: host unreachable`);
              }
            }
          }

          // Write probe cache
          const cacheData: Record<string, { status: number; responseTime: number; probedAt: string }> = {};
          for (const node of probedRoutes) {
            if (node.probe && node.probe.httpStatus !== undefined) {
              cacheData[node.path] = {
                status: node.probe.httpStatus,
                responseTime: node.probe.responseTime || 0,
                probedAt: node.probe.probedAt || new Date().toISOString(),
              };
            }
          }
          await writeProbeCache(projectDir, {
            probeUrl,
            probedAt: new Date().toISOString(),
            routes: cacheData,
          });
        }

        // Verbose output
        if (options.verbose) {
          log('\n  ── Discovery Details ──\n');
          const pages = report.nodes.filter((n: any) => n.type === 'page');
          const apis = report.nodes.filter((n: any) => n.type === 'api');
          const externals = report.nodes.filter((n: any) => n.type === 'external');
          const middleware = report.nodes.filter((n: any) => n.type === 'middleware');

          if (pages.length > 0) {
            log('  Pages:');
            for (const p of pages) {
              const r = (p as any).rendering ? ` [${(p as any).rendering}]` : '';
              const probe = (p as any).probe ? ` → ${(p as any).probe.httpStatus} (${(p as any).probe.responseTime}ms)` : '';
              log(`    ${(p as any).path}${r}${probe}  (${(p as any).filePath})`);
            }
          }
          if (apis.length > 0) {
            log('  API Routes:');
            for (const a of apis) {
              const m = (a as any).methods ? (a as any).methods.join(', ') : '';
              const probe = (a as any).probe ? ` → ${(a as any).probe.httpStatus} (${(a as any).probe.responseTime}ms)` : '';
              log(`    ${(a as any).path}  ${m}${probe}  (${(a as any).filePath})`);
            }
          }
          if (middleware.length > 0) {
            log('  Middleware:');
            for (const mw of middleware) {
              const patterns = (mw as any).matcherPatterns ? (mw as any).matcherPatterns.join(', ') : 'all routes';
              const auth = (mw as any).authProvider ? ` [${(mw as any).authProvider}]` : '';
              log(`    ${(mw as any).filePath}  matches: ${patterns}${auth}`);
            }
          }
          if (externals.length > 0) {
            log('  External Services:');
            for (const ext of externals) {
              const probe = (ext as any).probe
                ? ((ext as any).probe.reachable ? ` → reachable (${(ext as any).probe.latency}ms)` : ' → unreachable')
                : '';
              log(`    ${(ext as any).name}${probe}  (${(ext as any).detectedFrom})`);
            }
          }
          log(`\n  Groups: ${Object.keys(report.groups).join(', ')}`);
          log(`  Connectors: ${report.connectors.length}`);
          if (report.summary.renderingBreakdown) {
            const breakdown = Object.entries(report.summary.renderingBreakdown)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            if (breakdown) log(`  Rendering: ${breakdown}`);
          }
        }

        // Diff mode
        let diffResult = undefined as ReturnType<typeof compareTopology> | undefined;
        if (options.diff || options.diffFrom) {
          const prevRaw = options.diffFrom
            ? await readReportFromPath(options.diffFrom)
            : await readLastReport(projectDir);

          if (!prevRaw) {
            if (options.diffFrom) {
              log(`\n  ⚠ Could not read report at ${options.diffFrom}`);
            } else {
              log('\n  ⚠ No previous report found. Run shipmap once first, then use --diff on subsequent runs.');
            }
          } else {
            diffResult = compareTopology(report, prevRaw as TopologyReport);
            log(`\n  Diff: +${diffResult.summary.addedCount} new · -${diffResult.summary.removedCount} removed · ${diffResult.summary.changedCount} changed · ${diffResult.summary.unchangedCount} unchanged`);
          }
        }

        // Markdown output
        if (options.markdown) {
          const md = generateMarkdown(report);
          process.stdout.write(md);
          await writeLastReport(projectDir, report);
          await archiveReport(projectDir, report);
          return;
        }

        // CI mode
        if (options.ci) {
          const failRules = options.ciFailOn
            .split(',')
            .map((r) => r.trim())
            .filter((r): r is CiFailRule => ['errors', 'slow', 'unprotected', 'unreachable', 'new-unreviewed'].includes(r));

          const isTTY = process.stdout.isTTY ?? false;
          const ciResult = evaluateCi(report, failRules, {
            slowThreshold: parseInt(options.probeTimeout, 10),
            diffResult,
            protectedRouteIds: new Set(
              report.nodes
                .filter((n) => n.type === 'page' || n.type === 'api')
                .filter((n: any) => n.isProtected)
                .map((n) => n.id),
            ),
          });

          if (options.json) {
            const outputPath = options.output.endsWith('.html')
              ? options.output.replace('.html', '.json')
              : options.output;
            const jsonOutput = {
              ...report,
              ci: {
                result: ciResult,
                exitCode: ciResult.exitCode,
              },
            };
            await writeFile(outputPath, JSON.stringify(jsonOutput, null, 2));
            if (!options.quiet) {
              log(`\n  ✓ CI report saved to ${outputPath}\n`);
            }
          } else {
            const ciOutput = formatCiOutput(ciResult, report, isTTY);
            if (!options.quiet) {
              process.stdout.write(ciOutput);
            }
          }

          await writeLastReport(projectDir, report);
          await archiveReport(projectDir, report);
          process.exit(ciResult.exitCode);
        }

        // Watch/serve mode
        if (options.serve !== undefined && options.serve !== false) {
          const port = typeof options.serve === 'string' ? parseInt(options.serve, 10) : 3001;
          const { startWatchServer } = await import('./serve/watcher.js');
          await startWatchServer({
            projectDir,
            port,
            probeEnabled: !!options.probe,
            probeOptions: options.probe ? {
              baseUrl: probeUrl,
              timeout: probeTimeout,
              concurrency: probeConcurrency,
              headers: probeConfig.headers || {},
              exclude: probeExclude,
            } : undefined,
          });
          return; // Server keeps running
        }

        // Save last report + archive
        await writeLastReport(projectDir, report);
        await archiveReport(projectDir, report);

        // Output
        if (options.json) {
          const outputPath = options.output.endsWith('.html')
            ? options.output.replace('.html', '.json')
            : options.output;
          await writeFile(outputPath, JSON.stringify(report, null, 2));
          log(`\n  ✓ JSON saved to ${outputPath}\n`);
        } else {
          const html = generateReport(report, diffResult);
          await writeFile(options.output, html);
          log(`\n  ✓ Report saved to ${options.output}\n`);

          if (options.open) {
            const { execFile } = await import('node:child_process');
            const { resolve } = await import('node:path');
            const cmd = process.platform === 'darwin'
              ? 'open'
              : process.platform === 'win32'
                ? 'start'
                : 'xdg-open';
            execFile(cmd, [resolve(options.output)]);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`\n  ✗ Error: ${message}\n`);
        process.exit(1);
      }
    });

  return program;
}
