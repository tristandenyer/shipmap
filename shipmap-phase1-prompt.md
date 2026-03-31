# Phase 1 Super-Prompt — "First Wow"

> Paste this entire prompt into Claude Code to build shipmap v0.1.0 from scratch.

---

## Context

You are building **shipmap** — a CLI tool that auto-detects the frontend framework in a project, discovers every route, API handler, middleware, and external service dependency, and generates a self-contained interactive HTML topology map. The tagline is **"Map it before you ship it."**

This is Phase 1 (v0.1.0). The goal is static discovery only (no HTTP probing) for Next.js projects, producing a stunning interactive HTML report. The report must be visually impressive enough that developers screenshot it and share it.

The project lives at: `/Users/tristandenyer/Documents/github/shipmap`

The full master plan is at: `/Users/tristandenyer/Documents/github/shipmap-plan.md` — read it before starting. It contains the architecture, shared types, and non-negotiable principles.

---

## What to build

### 1. Project scaffold

Initialize the project:

```
shipmap/
├── bin/shipmap.js           # #!/usr/bin/env node — ESM entry
├── src/
│   ├── index.ts             # Main orchestrator
│   ├── cli.ts               # Commander-based CLI
│   ├── types.ts             # Shared types (copy from master plan exactly)
│   ├── detect/
│   │   └── framework.ts     # Framework auto-detection
│   ├── discover/
│   │   ├── index.ts         # Discovery orchestrator
│   │   └── nextjs/
│   │       ├── routes.ts    # App Router + Pages Router discovery
│   │       ├── api.ts       # API route discovery
│   │       ├── middleware.ts # Middleware detection
│   │       ├── rendering.ts # Rendering strategy detection
│   │       └── externals.ts # External service detection
│   └── report/
│       ├── generator.ts     # Topology data → HTML
│       ├── template.ts      # Main HTML template
│       └── assets/
│           ├── styles.ts    # Dark theme CSS
│           ├── canvas.ts    # Pan/zoom/drag engine
│           ├── connectors.ts # SVG bezier connector system
│           ├── layout.ts    # Auto-layout with directory grouping
│           ├── detail-panel.ts # Right-side detail panel
│           └── toolbar.ts   # Top toolbar
├── test/
│   ├── fixtures/
│   │   ├── nextjs-app-router/  # Minimal App Router project
│   │   ├── nextjs-pages-router/ # Minimal Pages Router project
│   │   └── nextjs-mixed/        # Both routers
│   ├── detect.test.ts
│   ├── discover.test.ts
│   ├── report.test.ts
│   └── cli.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .gitignore
├── LICENSE (MIT)
└── README.md
```

**package.json requirements:**
- name: `shipmap`
- version: `0.1.0`
- type: `module`
- bin: `{ "shipmap": "./bin/shipmap.js" }`
- engines: `{ "node": ">=18" }`
- scripts: build (tsup), test (vitest), lint (eslint)
- dependencies: `commander` (CLI), `@swc/core` (AST parsing for import analysis), `glob` (file discovery)
- devDependencies: `typescript`, `tsup`, `vitest`, `eslint`, `prettier`, `@types/node`
- NO other runtime dependencies. Keep it lean.

**tsup config:** ESM output, entry `src/index.ts`, target `node18`, dts generation.

### 2. Framework detection (`src/detect/framework.ts`)

Read `package.json` in the target directory (default: cwd). Check `dependencies` and `devDependencies`:

Priority order:
1. Has `next` → `'nextjs'`
2. Has `vite` + `@vitejs/plugin-react` → `'vite-react'`
3. Has `@remix-run/react` or `remix` → `'remix'`
4. Has `nuxt` → `'nuxt'`
5. Has `@sveltejs/kit` → `'sveltekit'`
6. Has `astro` → `'astro'`
7. Has `react-router-dom` without build frameworks → `'react-router-spa'`
8. Fallback → `'generic'`

Also detect framework version from the dependency value.

For Phase 1, only `'nextjs'` triggers full discovery. All others should return a clear message: "Framework detected: [name]. Full support coming in a future version. Currently only Next.js is supported."

Export: `async function detectFramework(projectDir: string): Promise<{ type: FrameworkType; version?: string }>`

### 3. Next.js route discovery (`src/discover/nextjs/routes.ts`)

Discover page routes from **both** App Router and Pages Router:

**App Router** (`app/` directory):
- Scan for `page.tsx`, `page.ts`, `page.jsx`, `page.js` files
- Convert file path to route: `app/dashboard/page.tsx` → `/dashboard`
- Handle dynamic segments: `app/users/[id]/page.tsx` → `/users/[id]`
- Handle catch-all: `app/docs/[...slug]/page.tsx` → `/docs/[...slug]`
- Handle route groups: `app/(marketing)/about/page.tsx` → `/about` (strip group)
- Handle parallel routes: `app/@modal/login/page.tsx` — note as parallel slot
- Detect `layout.tsx` files and associate with routes
- Detect `loading.tsx`, `error.tsx`, `not-found.tsx` — note as metadata

**Pages Router** (`pages/` directory):
- Scan for `.tsx`, `.ts`, `.jsx`, `.js` files (excluding `_app`, `_document`, `_error`)
- Convert file path to route: `pages/about.tsx` → `/about`
- Handle dynamic: `pages/posts/[id].tsx` → `/posts/[id]`
- Handle index: `pages/index.tsx` → `/`

For each discovered page route, create a `RouteNode` with:
- `type: 'page'`
- `path`: the resolved route
- `filePath`: relative path from project root
- `group`: directory grouping (e.g. all routes under `/dashboard/*` grouped as "dashboard")
- `rendering`: detected from `rendering.ts` (see below)
- `probe: { status: 'not-probed' }` (always, in Phase 1)

### 4. API route discovery (`src/discover/nextjs/api.ts`)

**App Router API routes:**
- Scan `app/` for `route.tsx`, `route.ts`, `route.js` files
- Parse the file to detect exported HTTP method handlers: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- Use regex first (look for `export async function GET` etc.), fall back to SWC AST parse if regex is ambiguous

**Pages Router API routes:**
- Scan `pages/api/` directory
- Default method is determined by parsing the handler (if `req.method === 'POST'` etc.)
- If no method check found, default to `['GET', 'POST']`

For each API route, create a `RouteNode` with:
- `type: 'api'`
- `methods`: array of detected HTTP methods
- `group`: directory grouping

### 5. Middleware detection (`src/discover/nextjs/middleware.ts`)

- Look for `middleware.ts` or `middleware.js` in project root and `src/` directory
- Parse the file to find:
  - `config.matcher` export — extract route patterns
  - If no matcher, middleware applies to all routes
- Detect auth provider from imports and code patterns:
  - Imports from `next-auth` → "NextAuth"
  - Imports from `@clerk/nextjs` → "Clerk"
  - Imports from `@supabase/ssr` → "Supabase"
- Detect redirect targets (look for `NextResponse.redirect` calls)
- Detect runtime (look for `export const runtime = 'edge'`)

Create a `MiddlewareNode` and create `Connector` entries for each route the middleware covers (type: `'middleware-coverage'`, style: `'dashed'`, color: `'orange'`, confidence: `'static'`).

### 6. Rendering strategy detection (`src/discover/nextjs/rendering.ts`)

For each page route, analyze the source file:

- `export const dynamic = 'force-dynamic'` → SSR
- `export const dynamic = 'force-static'` → SSG
- `export const revalidate = N` → ISR
- `export const runtime = 'edge'` → Edge
- `generateStaticParams` exported → SSG
- `getServerSideProps` exported → SSR (Pages Router)
- `getStaticProps` exported → SSG (Pages Router)
- `getStaticPaths` exported → SSG (Pages Router)
- Uses `cookies()`, `headers()`, or `searchParams` in server component → SSR
- `'use client'` directive at top → Client
- Default (no signals) → Static (Next.js default)

Also detect cache config:
- `export const revalidate = N` → `"revalidate:N"`
- `fetch(url, { cache: 'no-store' })` → `"no-store"`
- `fetch(url, { next: { revalidate: N } })` → `"revalidate:N"`

### 7. External service detection (`src/discover/nextjs/externals.ts`)

**From environment variables** (read `.env`, `.env.local`, `.env.development`, `next.config.js` env block):
- `STRIPE_` → Stripe
- `SUPABASE_` → Supabase
- `DATABASE_URL` → Database (parse protocol: `postgresql://` → PostgreSQL, `mysql://` → MySQL, `mongodb://` → MongoDB)
- `REDIS_` → Redis
- `RESEND_` or `SENDGRID_` → Email service
- `CLERK_` → Clerk (auth)
- `NEXTAUTH_` → NextAuth (auth)
- `AWS_` → AWS
- `FIREBASE_` → Firebase
- `OPENAI_` → OpenAI
- `ANTHROPIC_` → Anthropic
- `TWILIO_` → Twilio
- `CLOUDINARY_` → Cloudinary
- `SENTRY_` → Sentry
- `VERCEL_` → Vercel

**From import analysis** (scan source files for imports):
- `@stripe/stripe-js` or `stripe` → Stripe
- `@supabase/supabase-js` → Supabase
- `@prisma/client` → Prisma (note the database, not Prisma itself, is the external)
- `resend` → Resend
- `@sendgrid/mail` → SendGrid
- `@aws-sdk/*` → AWS
- `firebase` / `firebase-admin` → Firebase
- `openai` → OpenAI
- `@anthropic-ai/sdk` → Anthropic
- `ioredis` or `redis` → Redis

For each external service, create an `ExternalNode`. Then scan which route files import or reference each service — create `Connector` entries (type: `'external-dependency'`, style: `'dashed'`, color: `'blue'`, confidence: `'static'`).

**CRITICAL: Never include actual env var VALUES in the report. Only detect the SERVICE NAME from the var prefix.**

### 8. Discovery orchestrator (`src/discover/index.ts`)

```typescript
export async function discover(projectDir: string, framework: FrameworkType): Promise<{
  nodes: TopologyNode[];
  connectors: Connector[];
  groups: Record<string, string[]>;
}>
```

Delegates to the correct framework module. For Phase 1, only `'nextjs'` is implemented.

Collects all nodes and connectors, then computes groups by extracting directory prefixes from route paths:
- `/api/auth/login` and `/api/auth/register` → group "api/auth"
- `/dashboard` and `/dashboard/settings` → group "dashboard"
- Top-level routes with no shared prefix → group "root"

### 9. HTML report generation (`src/report/`)

This is the hero feature. The generated HTML must be a single self-contained file with ALL CSS and JS inlined. Zero external dependencies.

**Visual design targets:**
- Dark background: `#0d1117` (GitHub dark)
- Canvas area fills viewport
- Nodes are rounded rectangles with subtle border glow based on status
- Node header shows route path in monospace font
- Node body shows metadata (rendering strategy, methods, etc.)
- Connectors are SVG cubic bezier curves between nodes
- Groups are collapsible containers with a subtle background tint and label

**`template.ts`** — exports a function that takes `TopologyReport` and returns a complete HTML string:
```typescript
export function generateHTML(report: TopologyReport): string
```

The HTML structure:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>shipmap — {projectName}</title>
  <style>/* ALL CSS INLINED */</style>
</head>
<body>
  <div id="toolbar"><!-- Framework badge, stats, generation time --></div>
  <div id="canvas">
    <svg id="connectors-layer"></svg>
    <div id="canvas-inner">
      <!-- Nodes rendered here -->
    </div>
  </div>
  <div id="detail-panel"><!-- Slides in from right --></div>
  <script>
    const REPORT_DATA = /* JSON topology data */;
    /* ALL JS INLINED — canvas engine, connector drawing, layout, interactions */
  </script>
</body>
</html>
```

**`assets/styles.ts`** — CSS for:
- Dark theme with proper contrast ratios (WCAG AA minimum)
- Node styling: `.node-page`, `.node-api`, `.node-middleware`, `.node-external` with distinct color schemes
- Status indicator dots (grey for not-probed in Phase 1)
- Method badges: GET (green), POST (yellow), PUT (blue), DELETE (red)
- Rendering strategy badges: SSR (purple), SSG (green), ISR (amber), Edge (cyan), Static (grey), Client (orange)
- Group containers with collapsible headers
- Detail panel slide-in animation
- Toolbar layout
- Scrollbar styling
- Responsive: works from 1024px up

**`assets/canvas.ts`** — Pan and zoom engine:
- Mouse wheel zooms (scale clamped to [0.3, 2.5])
- Zoom targets mouse cursor position
- Click+drag on background pans
- `applyTransform()` applies `translate(tx, ty) scale(s)` to `#canvas-inner` and SVG layer
- Track transform state: `{ tx, ty, scale }`

**`assets/connectors.ts`** — SVG bezier connector system:
- Maintains a `CONNECTORS` array (from report data)
- `drawConnectors()` clears SVG, iterates connectors, draws each as a `<path>` element
- Cubic bezier: `M x1,y1 C x1+dx,y1 x2-dx,y2 x2,y2` where dx = half horizontal distance (min 50px)
- Port points calculated from node positions: source exits from right edge center, target enters from left edge center
- Connector colors mapped from data: green, amber, red, orange, grey, blue
- Dashed connectors use `stroke-dasharray: "8 4"`
- Connectors have hover tooltip showing confidence label
- `drawConnectors()` called on: initial render, node drag, group collapse/expand, zoom

**`assets/layout.ts`** — Auto-layout algorithm:
- Groups arranged in columns from left to right
- Within each group, nodes stacked vertically with padding
- Group order: middleware (leftmost) → pages → API routes → externals (rightmost)
- This creates a natural left-to-right flow: request → middleware → page/API → external service
- Initial positions calculated, then nodes are draggable (positions update on drag, connectors redraw)
- Group containers are collapsible: click group header to collapse to single node showing group label + route count
- When collapsed, connectors route to/from the group node instead of individual nodes

**`assets/detail-panel.ts`** — Detail panel:
- Slides in from right (300px wide) on node click
- Shows all node metadata in a clean layout
- Route path (large, monospace, copyable)
- File path (smaller, grey)
- Type-specific details:
  - Pages: rendering strategy, cache config, auth status, layout chain
  - API: methods with colored badges, cache config
  - Middleware: matcher patterns, auth provider, redirect target, runtime
  - External: service name, detected from (env/import/both), referencing routes list
- Close button + click outside to close

**`assets/toolbar.ts`** — Top toolbar:
- Left: shipmap logo/wordmark + framework badge (e.g. "Next.js 14.2.0")
- Center: summary stats (X pages, Y API routes, Z externals, N middleware)
- Right: generation timestamp + "Static mode — run with --probe for live status" hint

### 10. CLI (`src/cli.ts`)

Using `commander`:

```
shipmap [options]

Options:
  -d, --dir <path>      Target project directory (default: cwd)
  -o, --out <path>      Output file path (default: ./shipmap-report.html)
  --json                Output topology as JSON to stdout (no HTML generated)
  --no-open             Don't auto-open the report in the browser
  --verbose             Show detailed discovery output
  -V, --version         Output version
  -h, --help            Show help
```

**Flow:**
1. Detect framework
2. Run discovery
3. Compute summary stats
4. If `--json`: output `TopologyReport` JSON to stdout, exit
5. Else: generate HTML, write to output path
6. Unless `--no-open`: open the file in the default browser (`open` on macOS, `xdg-open` on Linux, `start` on Windows)
7. Print success message: `✓ shipmap report generated: ./shipmap-report.html (X pages, Y API routes, Z externals)`

**Error handling:**
- No `package.json` found → "No package.json found in [dir]. Are you in a project directory?"
- Unsupported framework → "Detected [framework] — full support coming soon. Currently only Next.js is supported."
- No routes found → "No routes discovered. Make sure your Next.js project has an `app/` or `pages/` directory."

### 11. Test fixtures

Create minimal but realistic Next.js project structures (just the files shipmap reads, not full projects):

**`test/fixtures/nextjs-app-router/`:**
- `package.json` with `next: "14.2.0"` in dependencies
- `app/page.tsx` — home page
- `app/about/page.tsx` — static page
- `app/dashboard/page.tsx` — SSR page (uses `cookies()`)
- `app/dashboard/settings/page.tsx` — client component (`'use client'`)
- `app/blog/[slug]/page.tsx` — SSG with `generateStaticParams`
- `app/api/users/route.ts` — GET + POST handlers
- `app/api/auth/[...nextauth]/route.ts` — NextAuth catch-all
- `middleware.ts` — with matcher config for `/dashboard/:path*`
- `.env.local` — with `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `DATABASE_URL=postgresql://...`

**`test/fixtures/nextjs-pages-router/`:**
- `package.json` with `next: "13.5.0"`
- `pages/index.tsx`
- `pages/about.tsx`
- `pages/posts/[id].tsx` — with `getStaticProps` + `getStaticPaths`
- `pages/api/users.ts` — default handler
- `pages/api/posts/[id].ts`

**`test/fixtures/nextjs-mixed/`:**
- Both `app/` and `pages/` directories
- Some overlap to test deduplication

### 12. Tests

**`test/detect.test.ts`:**
- Detects Next.js from package.json
- Detects Vite + React
- Detects each framework type
- Returns version
- Falls back to generic

**`test/discover.test.ts`:**
- Discovers App Router pages with correct paths
- Handles dynamic segments, catch-all, route groups
- Discovers Pages Router pages
- Discovers API routes with correct methods
- Detects middleware and matcher patterns
- Detects rendering strategies (SSR, SSG, ISR, Edge, Static, Client)
- Detects external services from env vars
- Detects external services from imports
- Computes correct directory groups
- Never leaks env var values

**`test/report.test.ts`:**
- Generated HTML is valid (contains DOCTYPE, html, head, body)
- HTML contains all discovered nodes
- HTML contains report data as JSON
- HTML is self-contained (no external URLs in link/script tags)

**`test/cli.test.ts`:**
- `--json` outputs valid JSON matching TopologyReport schema
- `--out` writes to specified path
- `--help` shows usage
- `--version` shows version
- Error cases: no package.json, unsupported framework

---

## Build & quality checklist

Before considering Phase 1 complete:

- [ ] `pnpm install` succeeds
- [ ] `pnpm build` produces working CLI
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no errors
- [ ] `npx shipmap --json -d test/fixtures/nextjs-app-router` outputs valid JSON
- [ ] `npx shipmap -d test/fixtures/nextjs-app-router` generates HTML that:
  - Opens in browser
  - Shows nodes for all routes
  - Shows nodes for API routes with method badges
  - Shows middleware node
  - Shows external service nodes (Stripe, PostgreSQL, NextAuth)
  - Connectors between middleware and covered routes
  - Connectors between routes and external services
  - Groups are collapsible
  - Pan and zoom works
  - Node drag works (connectors follow)
  - Detail panel opens on click
  - Toolbar shows correct framework and stats
- [ ] No env var values appear anywhere in the HTML output
- [ ] `npx shipmap` with no arguments in a non-project directory shows helpful error
- [ ] README.md has: installation, usage, screenshot placeholder, CLI flags, what it detects

---

## Implementation order

1. Scaffold project (package.json, tsconfig, tsup, vitest, eslint)
2. Types (`src/types.ts`)
3. Framework detection + tests
4. Route discovery (App Router) + tests
5. Route discovery (Pages Router) + tests
6. API route discovery + tests
7. Middleware detection + tests
8. Rendering strategy detection + tests
9. External service detection + tests
10. Discovery orchestrator + grouping
11. HTML report: template structure
12. HTML report: dark theme CSS
13. HTML report: canvas engine (pan/zoom/drag)
14. HTML report: connector system (SVG bezier)
15. HTML report: auto-layout with groups
16. HTML report: detail panel
17. HTML report: toolbar
18. CLI with commander
19. Integration tests
20. README
21. Final manual test against fixtures
22. `pnpm build` + verify `npx shipmap` works

---

## Critical implementation notes

- The HTML report is the product. Spend the most time making it beautiful and functional. If the CLI works perfectly but the report looks bad, Phase 1 has failed.
- The connector system MUST use the pattern from the planning doc: `CONNECTORS` array, `drawConnectors()` called on every drag frame, cubic bezier paths. This is proven to work.
- Node positions are stored as `style.left` and `style.top` on absolutely positioned divs. The canvas transform (`translate + scale`) is applied to the parent container. This separates node positioning from canvas navigation.
- External services should be visually distinct from routes — use a different shape or stronger border to indicate "this is outside your app."
- The auto-layout must handle real-world projects with 40+ routes without overlap. This means the layout algorithm needs to account for node dimensions and add proper spacing.
- All connectors in Phase 1 are grey/dashed because nothing is probed. But the connector system must support all colors/styles for Phase 2.
- Use `crypto.randomUUID()` for node IDs (available in Node 18+).
