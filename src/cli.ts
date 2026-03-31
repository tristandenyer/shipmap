import { Command } from 'commander';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { discover } from './discover/index.js';
import { generateReport } from './report/generator.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('shipmap')
    .description('Map it before you ship it. Generate an interactive topology map of your project.')
    .version('0.1.0');

  program
    .argument('[directory]', 'Project directory to scan', '.')
    .option('-o, --output <path>', 'Output file path', 'shipmap-report.html')
    .option('--json', 'Output raw JSON instead of HTML')
    .option('--no-open', 'Do not open the report in the browser')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('--verbose', 'Show detailed discovery output')
    .action(async (directory: string, options: {
      output: string;
      json?: boolean;
      open: boolean;
      quiet?: boolean;
      verbose?: boolean;
    }) => {
      const projectDir = resolve(directory);

      if (!options.quiet) {
        console.log('\n  ⚓ shipmap — Map it before you ship it\n');
      }

      try {
        if (!options.quiet) {
          console.log('  Detecting framework...');
        }
        const report = await discover(projectDir);

        if (!options.quiet) {
          console.log(`  Framework: ${report.meta.framework}${report.meta.frameworkVersion ? ` v${report.meta.frameworkVersion}` : ''}`);
          console.log(`  Found: ${report.summary.totalRoutes} pages, ${report.summary.totalApiRoutes} API routes, ${report.summary.totalExternals} external services`);
          if (report.summary.totalMiddleware > 0) {
            console.log(`  Middleware: ${report.summary.protectedRoutes} routes covered`);
          }
        }

        if (options.verbose) {
          console.log('\n  ── Discovery Details ──\n');
          const pages = report.nodes.filter((n: any) => n.type === 'page');
          const apis = report.nodes.filter((n: any) => n.type === 'api');
          const externals = report.nodes.filter((n: any) => n.type === 'external');
          const middleware = report.nodes.filter((n: any) => n.type === 'middleware');

          if (pages.length > 0) {
            console.log('  Pages:');
            for (const p of pages) {
              const r = (p as any).rendering ? ` [${(p as any).rendering}]` : '';
              console.log(`    ${(p as any).path}${r}  (${(p as any).filePath})`);
            }
          }
          if (apis.length > 0) {
            console.log('  API Routes:');
            for (const a of apis) {
              const m = (a as any).methods ? (a as any).methods.join(', ') : '';
              console.log(`    ${(a as any).path}  ${m}  (${(a as any).filePath})`);
            }
          }
          if (middleware.length > 0) {
            console.log('  Middleware:');
            for (const mw of middleware) {
              const patterns = (mw as any).matcherPatterns ? (mw as any).matcherPatterns.join(', ') : 'all routes';
              const auth = (mw as any).authProvider ? ` [${(mw as any).authProvider}]` : '';
              console.log(`    ${(mw as any).filePath}  matches: ${patterns}${auth}`);
            }
          }
          if (externals.length > 0) {
            console.log('  External Services:');
            for (const ext of externals) {
              console.log(`    ${(ext as any).name}  (${(ext as any).detectedFrom})`);
            }
          }
          console.log(`\n  Groups: ${Object.keys(report.groups).join(', ')}`);
          console.log(`  Connectors: ${report.connectors.length}`);
          if (report.summary.renderingBreakdown) {
            const breakdown = Object.entries(report.summary.renderingBreakdown)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            if (breakdown) console.log(`  Rendering: ${breakdown}`);
          }
        }

        if (options.json) {
          const outputPath = options.output.endsWith('.html')
            ? options.output.replace('.html', '.json')
            : options.output;
          await writeFile(outputPath, JSON.stringify(report, null, 2));
          if (!options.quiet) {
            console.log(`\n  ✓ JSON saved to ${outputPath}\n`);
          }
        } else {
          const html = generateReport(report);
          await writeFile(options.output, html);
          if (!options.quiet) {
            console.log(`\n  ✓ Report saved to ${options.output}\n`);
          }

          if (options.open) {
            const { exec } = await import('node:child_process');
            const cmd = process.platform === 'darwin'
              ? 'open'
              : process.platform === 'win32'
                ? 'start'
                : 'xdg-open';
            exec(`${cmd} ${options.output}`);
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
