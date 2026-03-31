# shipmap — Master Build Plan

> **"Map it before you ship it."**
>
> A CLI tool that auto-detects your frontend framework, discovers every route, API handler, middleware, and external service dependency, and generates a self-contained interactive HTML topology map — nodes on a dark canvas with smooth bezier connectors, status indicators, and a detail panel — that opens in a browser with zero configuration.

```bash
npx shipmap
```

---

## Architecture Overview

```
shipmap/
├── bin/
│   └── shipmap.js              # CLI entry point (#!/usr/bin/env node)
├── src/
│   ├── index.ts                # Main orchestrator
│   ├── cli.ts                  # Argument parsing (commander)
│   ├── detect/
│   │   └── framework.ts        # Auto-detect framework from package.json + filesystem
│   ├── discover/
│   │   ├── nextjs/
│   │   │   ├── routes.ts       # App Router + Pages Router discovery
│   │   │   ├── api.ts          # API route discovery
│   │   │   ├── middleware.ts   # Middleware detection + route matching
│   │   │   ├── rendering.ts   # SSR/SSG/ISR/Edge strategy detection
│   │   │   └── externals.ts   # External service detection (env vars + imports)
│   │   └── index.ts            # Discovery orchestrator (delegates to framework)
│   ├── probe/                  # Phase 2
│   │   ├── http.ts             # HTTP prober
│   │   ├── auth.ts             # Auth auto-detection from .env.local
│   │   └── external.ts        # External service reachability
│   ├── report/
│   │   ├── generator.ts        # Assembles topology data → HTML
│   │   ├── template.ts         # HTML template with embedded JS/CSS
│   │   └── assets/
│   │       ├── styles.ts       # Dark theme CSS (embedded as string)
│   │       ├── canvas.ts       # Pan/zoom/drag engine
│   │       ├── connectors.ts   # SVG bezier connector system
│   │       ├── layout.ts       # Auto-layout algorithm (grouped by directory)
│   │       ├── detail-panel.ts # Right-side detail panel
│   │       └── toolbar.ts      # Top toolbar (framework badge, stats, search)
│   ├── diff/                   # Phase 3
│   │   └── compare.ts          # Diff current vs previous run
│   ├── serve/                  # Phase 2
│   │   └── watcher.ts          # File watcher + live reload server
│   └── types.ts                # Shared TypeScript types
├── test/
│   ├── fixtures/               # Minimal Next.js project structures for testing
│   │   ├── nextjs-app-router/
│   │   ├── nextjs-pages-router/
│   │   └── nextjs-mixed/
│   ├── detect.test.ts
│   ├── discover.test.ts
│   ├── report.test.ts
│   └── cli.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── LICENSE                     # MIT
└── README.md
```

---

## Shared Types (all phases reference this)

```typescript
// src/types.ts

export type FrameworkType =
  | 'nextjs'
  | 'vite-react'
  | 'remix'
  | 'nuxt'
  | 'sveltekit'
  | 'astro'
  | 'react-router-spa'
  | 'generic';

export type RenderingStrategy = 'SSR' | 'SSG' | 'ISR' | 'Edge' | 'Static' | 'Client' | 'Unknown';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type NodeType = 'page' | 'api' | 'middleware' | 'external';

export type ProbeStatus = 'ok' | 'slow' | 'warn' | 'error' | 'not-probed';

export interface RouteNode {
  id: string;
  type: NodeType;
  path: string;                    // e.g. "/dashboard" or "/api/users"
  filePath: string;                // e.g. "app/dashboard/page.tsx"
  group: string;                   // directory grouping, e.g. "/api/auth"
  label: string;                   // display label
  methods?: HttpMethod[];          // API routes only
  rendering?: RenderingStrategy;   // Pages only
  isProtected?: boolean;           // auth-guarded
  cacheConfig?: string;            // "no-store", "revalidate:60", etc.
  middleware?: string[];           // middleware IDs that cover this route
  externals?: string[];           // external service IDs this route references
  probe?: {
    status: ProbeStatus;
    httpStatus?: number;
    responseTime?: number;         // ms
    probedAt?: string;             // ISO timestamp
    methodResults?: Record<HttpMethod, {
      httpStatus: number;
      responseTime: number;
    }>;
  };
}

export interface MiddlewareNode {
  id: string;
  type: 'middleware';
  filePath: string;
  matcherPatterns: string[];       // route patterns it applies to
  authProvider?: string;           // "NextAuth", "Clerk", etc.
  redirectTarget?: string;
  runtime: 'edge' | 'node';
}

export interface ExternalNode {
  id: string;
  type: 'external';
  name: string;                    // "Stripe", "Supabase", etc.
  host?: string;                   // detected host URL
  detectedFrom: 'env' | 'import' | 'both';
  referencedBy: string[];          // route IDs that use it
  probe?: {
    reachable: boolean;
    latency?: number;
    probedAt?: string;
  };
}

export type TopologyNode = RouteNode | MiddlewareNode | ExternalNode;

export interface Connector {
  source: string;                  // node ID
  target: string;                  // node ID
  type: 'call' | 'middleware-coverage' | 'external-dependency' | 'inferred';
  confidence: 'static' | 'probed' | 'inferred';
  label?: string;
  style: 'solid' | 'dashed';
  color: 'green' | 'amber' | 'red' | 'orange' | 'grey' | 'blue';
}

export interface TopologyReport {
  meta: {
    tool: 'shipmap';
    version: string;
    generatedAt: string;           // ISO timestamp
    framework: FrameworkType;
    frameworkVersion?: string;
    projectName: string;
    mode: 'static' | 'probe';
  };
  nodes: TopologyNode[];
  connectors: Connector[];
  groups: Record<string, string[]>; // group label → node IDs
  summary: {
    totalRoutes: number;
    totalApiRoutes: number;
    totalMiddleware: number;
    totalExternals: number;
    protectedRoutes: number;
    renderingBreakdown: Record<RenderingStrategy, number>;
    errors?: number;               // probe mode only
  };
}
```

---

## Phase 1 — "First Wow" (v0.1.0)

**Goal:** `npx shipmap` on a Next.js project outputs a stunning `shipmap-report.html` with accurate static topology. No probing. Grey status indicators. But the report is so visually impressive people screenshot it and share it.

**What ships:**
- CLI with `shipmap` command (no flags needed for basic use)
- `--json` flag outputs `TopologyReport` to stdout
- `--out <path>` to customize output location (default: `./shipmap-report.html`)
- `--no-open` to suppress auto-opening browser
- Framework auto-detection (Next.js fully supported, others show "coming soon")
- Next.js App Router + Pages Router route discovery
- API route discovery with HTTP method detection
- Middleware detection with route matcher parsing
- Rendering strategy detection (SSR/SSG/ISR/Edge/Static)
- External service detection from env vars + import patterns
- Node grouping by directory (collapsible clusters)
- Interactive HTML report: dark canvas, pan/zoom, drag nodes, bezier connectors
- Detail panel on node click
- Framework badge + summary stats in toolbar
- All connectors are grey/dashed (static analysis only, honest about confidence)
- `--verbose` flag for debug output during discovery

**What does NOT ship:** probe mode, watch mode, diff, search, keyboard shortcuts, auth detection.

**Test matrix:**
- Unit: framework detection, route discovery, API discovery, middleware parsing, rendering strategy detection
- Integration: run against fixture projects, verify JSON output schema
- Snapshot: generated HTML contains expected nodes/connectors for fixture projects
- E2E: `npx shipmap --json` on fixture project, validate output

---

## Phase 2 — "Sticky" (v0.2.0)

**Goal:** Probe mode brings the map to life with real HTTP status codes and response times. Watch mode makes it a second-monitor companion during development. This is what makes people keep it installed.

**What ships:**
- `--probe` flag: makes HTTP requests to all discovered routes
- `--probe-url <url>` to specify base URL (default: `http://localhost:3000`)
- Auth auto-detection from `.env.local`:
  - `NEXTAUTH_SECRET` → NextAuth session token generation
  - `CLERK_SECRET_KEY` → Clerk test JWT
  - `SUPABASE_SERVICE_ROLE_KEY` → Supabase service role
  - `BASIC_AUTH_USER` + `BASIC_AUTH_PASSWORD` → Authorization header
  - Fallback: `shipmap.config.js` for custom headers
- External service reachability checks (ping host, report latency)
- Live status colors on nodes: green (200), amber (slow/3xx), red (4xx/5xx), blue (external), grey (not probed)
- Solid vs dashed connectors based on confidence (probed vs static)
- Response time displayed on nodes
- `--serve` flag: starts local server on `:3001`, watches `app/`, `pages/`, `src/` for changes, auto-rebuilds report with live reload
- `shipmap.config.js` support for custom probe headers, base URL, excluded routes
- Probe results cached in `.shipmap/` to avoid re-probing unchanged routes

**What does NOT ship:** diff mode, keyboard shortcuts, search, Markdown export.

**Test matrix:**
- Unit: auth detection per provider, probe result classification, config file loading
- Integration: probe against a local test server with known responses
- Mock: external service reachability with mocked DNS
- E2E: `shipmap --probe --probe-url http://localhost:3000 --json` validates live status in output

---

## Phase 3 — "Power User" (v0.3.0)

**Goal:** The features that make power users evangelize the tool. Keyboard-driven, searchable, diffable, exportable.

**What ships:**
- **Diff mode:** `shipmap --diff` compares current topology to `.shipmap/last-report.json`, highlights:
  - New routes (green glow + "NEW" badge)
  - Removed routes (strikethrough + red, shown as ghost nodes)
  - Status changes (amber highlight with before → after)
  - Diff summary in toolbar: "+3 routes, -1 route, 2 status changes"
- **Keyboard shortcuts:**
  - `F` — fit all nodes to screen
  - `Escape` — close detail panel
  - `/` — focus search bar
  - Arrow keys — navigate between nodes
  - `C` — copy selected node's route path to clipboard
  - `O` — open route in browser (probe mode only)
  - `G` — toggle group collapse/expand
  - `?` — show keyboard shortcut overlay
- **Search & filter:**
  - Search bar highlights matching nodes, fades non-matching
  - Filter buttons: by type (pages, API, middleware, external), by status (errors only, slow only), by rendering strategy
  - Filter state persisted in URL hash for shareability
- **Copy route path** — click icon on any node to copy path
- **Open in browser** — button on page/API nodes opens `baseUrl/[route]` in new tab
- **Stale snapshot warning** — if HTML file is >4 hours old when opened, shows dismissible banner
- **Copy as Markdown** — `shipmap --markdown` or toolbar button exports topology as Markdown table:
  ```markdown
  ## Routes
  | Path | Type | Methods | Rendering | Status | Auth |
  |------|------|---------|-----------|--------|------|
  | /dashboard | Page | GET | SSR | 200 (45ms) | Protected |
  ```
- **Previous report archival** — each run saves to `.shipmap/history/` with timestamp

**What does NOT ship:** multi-framework, CI mode, snytch integration.

**Test matrix:**
- Unit: diff algorithm (added/removed/changed detection), Markdown export formatting, keyboard event handling
- Integration: generate two reports with known differences, verify diff output
- E2E: full diff workflow — run twice with filesystem changes between, verify diff report

---

## Phase 4 — "Platform" (v0.4.0)

**Goal:** Multi-framework support, CI integration, and ecosystem hooks. shipmap becomes framework-agnostic and CI-friendly.

**What ships:**
- **Multi-framework discovery:**
  - Vite + React: scan `dist/assets/`, `src/routes/` or `react-router` config
  - Remix: scan `app/routes/`, `build/` directory, loader/action detection
  - SvelteKit: scan `src/routes/`, `+page.svelte` / `+server.ts` patterns
  - Astro: scan `src/pages/`, island detection, SSR vs static per page
  - Nuxt: scan `pages/`, `server/api/`, middleware directory
  - React Router SPA: parse router config from source
  - Generic fallback: scan for `/api`, `/routes`, `/pages` patterns
- **CI mode:** `shipmap --ci` exits with non-zero code if:
  - Any probed route returns 5xx
  - New unprotected routes detected (configurable)
  - External dependency unreachable
  - Outputs machine-readable summary to stdout
- **GitHub Actions recipe** in README:
  ```yaml
  - name: Topology check
    run: npx shipmap --ci --probe --probe-url ${{ env.PREVIEW_URL }}
  ```
- **JSON schema** published and documented for `TopologyReport`
- **snytch integration** — if `@snytch/next` results exist, show security badge on flagged nodes
- **Config file expansion** — `shipmap.config.js` supports:
  - `exclude: ['/api/internal/*']` — routes to skip
  - `groups: { 'Auth': '/api/auth/*' }` — custom grouping labels
  - `ci: { failOnError: true, failOnUnprotected: false }` — CI thresholds
- **`--quiet`** flag — minimal output for CI pipelines
- **Exit codes:** 0 = clean, 1 = errors found, 2 = config error

**Test matrix:**
- Unit: each framework's discovery module against fixtures
- Integration: CI mode exit codes for various scenarios
- E2E: run against real (small) projects for each supported framework
- Compatibility: Node 18, 20, 22

---

## Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Type safety for the complex topology data |
| Build | tsup | Fast, zero-config, ESM + CJS dual output |
| CLI framework | commander | Lightweight, proven, good DX |
| Test runner | vitest | Fast, native TS, compatible with our stack |
| File watching | chokidar | De facto standard, reliable |
| HTTP probing | undici | Built into Node 18+, fast |
| AST parsing | @swc/core | Fast TS/JS parsing for import analysis |
| Template engine | None — string templates | HTML report is self-contained, no deps |
| CSS | Embedded in template | Dark theme, no external stylesheet |
| Linting | eslint + prettier | Standard |
| Package manager | pnpm | Fast, strict |

---

## Non-Negotiable Principles

1. **Zero config to start.** `npx shipmap` must work with zero setup on any Next.js project.
2. **Honest confidence.** Every connector and status indicator shows HOW it was detected. One false positive destroys trust.
3. **Self-contained output.** The HTML file has zero external dependencies. Works offline. Email it to a colleague.
4. **Fast.** Static mode must complete in <5 seconds for a 100-route project. Probe mode limited by network, but parallelized.
5. **No secrets leaked.** Env vars used for auth are never written to the report. Only the auth *provider name* is shown.
6. **Beautiful by default.** The dark canvas with bezier connectors should look good enough to put in a README screenshot.

---

## Success Metrics

- **Phase 1:** `npx shipmap` works on 3 real Next.js projects (different sizes), produces accurate topology, HTML report looks professional
- **Phase 2:** Probe mode correctly identifies status for all routes on a running Next.js app, watch mode auto-refreshes on file changes
- **Phase 3:** Diff mode catches route additions/removals between two runs, all keyboard shortcuts work in Chrome/Firefox/Safari
- **Phase 4:** Works on at least 3 frameworks beyond Next.js, CI mode exits correctly in GitHub Actions

---
