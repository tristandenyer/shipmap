# Phase 4 Super-Prompt — "Platform"

> Paste this entire prompt into Claude Code to build shipmap v0.4.0. Phases 1-3 must be complete first.

---

## Context

You are continuing work on **shipmap** — "Map it before you ship it." Phases 1-3 are complete: static discovery, interactive HTML report, probe mode, watch mode, diff mode, keyboard shortcuts, search/filter, Markdown export.

Phase 4 transforms shipmap from a **Next.js tool** into a **framework-agnostic platform** and adds CI integration. This is the phase that multiplies the user base and makes shipmap part of professional deployment workflows.

The project is at `/Users/tristandenyer/Documents/github/shipmap`. Read the master plan at `/Users/tristandenyer/Documents/github/shipmap-plan.md`.

**IMPORTANT:** Before making changes, read the existing codebase thoroughly. The discovery system was designed from Phase 1 to be extensible — framework detection routes to framework-specific discovery modules. Phase 4 fills in those modules. Every existing test must continue to pass.

---

## What to build

### 1. Multi-framework discovery modules

Each framework gets its own discovery module under `src/discover/<framework>/`. Each module must export the same interface:

```typescript
// src/discover/types.ts (shared interface)
export interface FrameworkDiscoverer {
  discoverRoutes(projectDir: string): Promise<RouteNode[]>;
  discoverApiRoutes(projectDir: string): Promise<RouteNode[]>;
  discoverMiddleware(projectDir: string): Promise<MiddlewareNode[]>;
  discoverExternals(projectDir: string): Promise<ExternalNode[]>;
}
```

Update `src/discover/index.ts` to delegate to the correct module based on detected framework.

#### Vite + React (`src/discover/vite-react/`)

**Route discovery:**
- Check for `react-router-dom` in dependencies
- Scan for router configuration:
  - `createBrowserRouter` / `createHashRouter` calls
  - `<Route>` JSX elements in source files
  - Route config arrays (`{ path: '/dashboard', element: <Dashboard /> }`)
- Parse route config using SWC AST to extract paths, nested routes, lazy-loaded routes
- Also scan `dist/assets/*.js` if build output exists — extract route strings from bundled code
- Handle dynamic segments: `:id` → `[id]` (normalize to Next.js-style for consistent display)

**API routes:**
- Vite projects typically don't have built-in API routes
- Check for Express/Fastify server files if they exist alongside the Vite project
- Scan for `fetch('/api/...')` calls in source to detect API endpoints being consumed (mark as "inferred")

**Middleware:**
- No built-in middleware concept in Vite/React
- Skip middleware discovery, return empty array

**Externals:**
- Same env var + import scanning as Next.js (reuse the logic)

#### Remix (`src/discover/remix/`)

**Route discovery:**
- Scan `app/routes/` directory
- Remix v2 flat route convention:
  - `app/routes/_index.tsx` → `/`
  - `app/routes/about.tsx` → `/about`
  - `app/routes/dashboard.tsx` → `/dashboard` (layout)
  - `app/routes/dashboard._index.tsx` → `/dashboard` (index)
  - `app/routes/dashboard.settings.tsx` → `/dashboard/settings`
  - `app/routes/$userId.tsx` → `/:userId` → normalize to `/[userId]`
  - `app/routes/$.tsx` → catch-all/splat
- Detect `loader` exports → SSR data loading
- Detect `action` exports → form mutations (mark as POST handler)
- Detect `clientLoader` → client-side data
- Detect `meta` exports → has metadata
- Detect `ErrorBoundary` exports → has error handling

**API routes:**
- In Remix, API-only routes are routes that export `loader`/`action` but no default component
- Detect these as API routes
- Routes with `action` export → has POST method
- Routes with `loader` export → has GET method

**Middleware:**
- No traditional middleware in Remix
- But `app/root.tsx` acts like a global layout/middleware — detect auth patterns here
- Detect `headers` function exports for cache/auth headers

**Externals:**
- Same env var + import scanning (reuse)

#### SvelteKit (`src/discover/sveltekit/`)

**Route discovery:**
- Scan `src/routes/` directory
- SvelteKit convention:
  - `src/routes/+page.svelte` → `/`
  - `src/routes/about/+page.svelte` → `/about`
  - `src/routes/dashboard/+page.svelte` → `/dashboard`
  - `src/routes/posts/[slug]/+page.svelte` → `/posts/[slug]`
  - `src/routes/(marketing)/about/+page.svelte` → `/about` (group stripped)
- Detect rendering:
  - `+page.server.ts` with `load` → SSR
  - `+page.ts` with `load` → Universal (can be SSR or client)
  - `export const prerender = true` → SSG
  - `export const ssr = false` → Client only

**API routes (SvelteKit "server routes"):**
- `src/routes/api/*/+server.ts` files
- Detect exported functions: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- Same pattern as Next.js App Router route handlers

**Middleware:**
- `src/hooks.server.ts` → server hooks (acts like middleware)
- `src/hooks.client.ts` → client hooks
- Detect `handle` function export — this is the middleware equivalent
- Detect auth patterns within hooks

**Externals:**
- Same scanning (reuse)

#### Astro (`src/discover/astro/`)

**Route discovery:**
- Scan `src/pages/` directory
- Astro convention:
  - `src/pages/index.astro` → `/`
  - `src/pages/about.astro` → `/about`
  - `src/pages/blog/[slug].astro` → `/blog/[slug]`
  - `.astro` files → Static by default
  - `.ts`/`.js` files in pages → API endpoints
- Detect rendering:
  - Default: Static (Astro generates static HTML)
  - `export const prerender = false` → SSR
  - Check `astro.config.mjs` for `output: 'server'` → all SSR by default
  - Check for `output: 'hybrid'` → SSG default, opt-in SSR
- Detect island framework usage: React, Vue, Svelte, Solid components within Astro files

**API routes:**
- `.ts`/`.js` files in `src/pages/` that export HTTP handlers
- Detect: `export const GET`, `export const POST`, etc.

**Middleware:**
- `src/middleware.ts` or `src/middleware/index.ts`
- Detect `onRequest` export
- Detect `sequence()` for chained middleware

**Externals:**
- Same scanning (reuse)

#### Nuxt (`src/discover/nuxt/`)

**Route discovery:**
- Scan `pages/` directory (Nuxt 3 auto-routes from filesystem)
- Convention:
  - `pages/index.vue` → `/`
  - `pages/about.vue` → `/about`
  - `pages/users/[id].vue` → `/users/[id]`
  - `pages/[...slug].vue` → catch-all
- Detect rendering:
  - Default: Universal (SSR + client hydration)
  - `definePageMeta({ ssr: false })` → Client only
  - Check `nuxt.config.ts` for `ssr: false` → full SPA
  - `routeRules` in config for per-route rendering

**API routes (Nuxt "server routes"):**
- Scan `server/api/` directory
- `server/api/users.ts` → `/api/users`
- `server/api/users/[id].ts` → `/api/users/[id]`
- Detect `defineEventHandler` exports
- Detect HTTP method from filename: `users.get.ts`, `users.post.ts`

**Middleware:**
- Scan `server/middleware/` → server middleware (runs on every request)
- Scan `middleware/` → route middleware (Vue navigation guards)
- Detect `defineNuxtRouteMiddleware` exports
- Detect auth patterns

**Externals:**
- Same scanning (reuse)

#### React Router SPA (`src/discover/react-router-spa/`)

**Route discovery:**
- Same as Vite + React route detection, but for projects using `react-router-dom` without a build framework
- Scan for router configuration in source files
- All routes are "Client" rendering (it's a SPA)

**API/Middleware:** None (SPA has no server). Return empty arrays.

**Externals:** Same scanning (reuse).

#### Generic fallback (`src/discover/generic/`)

For unrecognized frameworks:
- Scan for common patterns:
  - Any `pages/`, `routes/`, `views/` directories
  - Any `api/` directories
  - Any files with route-like exports
- Best-effort discovery with low confidence
- All connectors marked as `'inferred'`

### 2. CI mode (`--ci` flag)

```
--ci                     Exit with non-zero code on failures
--ci-fail-on <rules>     Comma-separated failure rules (default: "errors")
```

**Exit codes:**
- `0` — all checks passed
- `1` — failures detected (based on `--ci-fail-on` rules)
- `2` — configuration error (bad flags, missing project, etc.)

**Failure rules (`--ci-fail-on`):**
- `errors` — any probed route returned 5xx (default)
- `slow` — any route exceeded slow threshold (configurable via `--probe-timeout`)
- `unprotected` — new routes detected without middleware/auth coverage
- `unreachable` — external service host unreachable
- `new-unreviewed` — new routes found vs previous run (use with `--diff`)

Examples:
```bash
# Fail on server errors only
shipmap --ci --probe --probe-url $PREVIEW_URL

# Fail on errors or slow responses
shipmap --ci --ci-fail-on errors,slow --probe --probe-url $PREVIEW_URL

# Fail if new routes appear without auth (security gate)
shipmap --ci --ci-fail-on unprotected --diff
```

**CI output format:**
- Minimal, machine-readable when piped
- Human-readable with colors when TTY
- JSON output with `--json --ci` for programmatic consumption

```
shipmap CI — Next.js 14.2.0

✓ 45 routes OK
✗ 2 routes with errors:
  /api/payments (POST → 500 Internal Server Error)
  /api/webhooks/stripe (POST → 502 Bad Gateway)
⚠ 1 slow route:
  /dashboard/analytics (GET → 200 OK, 4230ms)
✓ 3 external services reachable

EXIT 1: 2 errors found
```

### 3. GitHub Actions recipe

Create a reusable workflow example in the README and as a standalone file:

**`.github/workflows/shipmap.yml` example** (documented in README):

```yaml
name: Topology Check
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  shipmap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build

      # Static check (no running server needed)
      - name: Topology scan
        run: npx shipmap --ci --diff --json > shipmap-report.json

      # Optional: with probe against preview deployment
      # - name: Topology probe
      #   run: npx shipmap --ci --probe --probe-url ${{ env.PREVIEW_URL }}

      - name: Upload topology report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: shipmap-report
          path: shipmap-report.html

      # Optional: Comment on PR with topology changes
      - name: Comment topology diff
        if: always()
        run: |
          npx shipmap --diff --markdown > /tmp/topology-diff.md
          gh pr comment ${{ github.event.pull_request.number }} --body-file /tmp/topology-diff.md
        env:
          GH_TOKEN: ${{ github.token }}
```

### 4. Config file expansion

Extend `shipmap.config.js` for Phase 4 features:

```javascript
export default {
  // Existing
  probe: { /* ... */ },

  // New in Phase 4
  discovery: {
    exclude: ['**/test/**', '**/fixtures/**'],  // Glob patterns to skip during discovery
    include: ['src/routes/**'],                  // Override default scan directories
  },

  groups: {
    'Authentication': '/api/auth/*',             // Custom group labels
    'Payments': '/api/payments/*',
    'User Management': ['/api/users/*', '/dashboard/users/*'],  // Multiple patterns
  },

  ci: {
    failOn: ['errors'],                          // Same as --ci-fail-on
    slowThreshold: 3000,                         // ms, default 2000
    allowUnprotected: ['/api/public/*', '/'],    // Routes exempt from unprotected check
  },
}
```

### 5. JSON schema for TopologyReport

Create and publish the JSON schema so external tools can consume shipmap output:

**`schema/topology-report.schema.json`:**
- Full JSON Schema (draft-07) describing `TopologyReport`
- Include descriptions for every field
- Include examples
- Reference in package.json: `"shipmap": { "schema": "./schema/topology-report.schema.json" }`

### 6. snytch integration

If `@snytch/next` scan results exist (check for `.snytch/` directory or `snytch-report.json`):

- Read snytch findings
- For any route where snytch found an exposed secret:
  - Add a red shield icon/badge on the node: 🛡️ with count
  - In detail panel: "Snytch: X secrets found in this route's bundle" with severity
  - Connector from route to a special "Security Findings" node (if multiple routes affected)
- If snytch results NOT found: do nothing (no error, no warning — it's optional)
- In toolbar: "snytch: X findings" summary if results exist

**Detection logic:**
- Look for `.snytch/scan-results.json` or `snytch-report.json` in project root
- Parse the results and match findings to routes by file path
- This is intentionally loose coupling — if snytch changes its output format, shipmap just silently ignores it

### 7. `--quiet` flag

```
--quiet     Minimal output (for CI pipelines)
```

- Suppresses all output except:
  - Error messages
  - CI pass/fail result
  - File path of generated report
- Useful when piping or in noisy CI environments

### 8. Test fixtures for new frameworks

Create minimal fixture projects:

**`test/fixtures/vite-react/`:**
- `package.json` with `vite`, `react`, `react-router-dom`
- `src/main.tsx` with `createBrowserRouter` config
- `src/routes/Dashboard.tsx`, `src/routes/Settings.tsx`
- `.env` with `VITE_STRIPE_KEY`, `VITE_SUPABASE_URL`

**`test/fixtures/remix-v2/`:**
- `package.json` with `@remix-run/react`, `@remix-run/node`
- `app/routes/_index.tsx`, `app/routes/dashboard.tsx`
- `app/routes/dashboard.settings.tsx`
- `app/routes/api.users.tsx` (loader + action, no component)
- `app/root.tsx` with auth check

**`test/fixtures/sveltekit/`:**
- `package.json` with `@sveltejs/kit`
- `src/routes/+page.svelte`, `src/routes/about/+page.svelte`
- `src/routes/api/users/+server.ts` with GET + POST
- `src/hooks.server.ts` with auth check

**`test/fixtures/astro/`:**
- `package.json` with `astro`
- `src/pages/index.astro`, `src/pages/about.astro`
- `src/pages/api/users.ts` with GET handler
- `astro.config.mjs` with `output: 'hybrid'`

**`test/fixtures/nuxt3/`:**
- `package.json` with `nuxt`
- `pages/index.vue`, `pages/about.vue`, `pages/users/[id].vue`
- `server/api/users.ts`, `server/api/users/[id].get.ts`
- `server/middleware/auth.ts`
- `middleware/auth.ts` (route middleware)

### 9. Tests

**`test/discover-vite.test.ts`:**
- Discovers routes from `createBrowserRouter` config
- Handles dynamic segments
- Detects externals from `VITE_` prefixed env vars

**`test/discover-remix.test.ts`:**
- Discovers flat routes with correct paths
- Detects loaders (GET) and actions (POST)
- Identifies API-only routes (no component)

**`test/discover-sveltekit.test.ts`:**
- Discovers routes from filesystem
- Detects server routes with correct methods
- Detects hooks.server.ts as middleware

**`test/discover-astro.test.ts`:**
- Discovers `.astro` pages
- Detects API endpoints
- Detects SSR vs static from config

**`test/discover-nuxt.test.ts`:**
- Discovers auto-routes from pages/
- Discovers server API routes
- Detects both server and route middleware

**`test/ci.test.ts`:**
- Exit code 0 when no errors
- Exit code 1 when errors found
- Exit code 1 when slow routes and `--ci-fail-on slow`
- Exit code 2 on config error
- `--quiet` suppresses verbose output
- `--json --ci` outputs valid JSON with exit code

**`test/config-extended.test.ts`:**
- Custom groups applied correctly
- Discovery exclude patterns work
- CI config loaded from file
- CLI flags override config

**`test/snytch.test.ts`:**
- Detects snytch results when present
- Ignores gracefully when not present
- Correctly maps findings to routes
- Security badges appear on affected nodes

---

## Build & quality checklist

Before considering Phase 4 complete:

- [ ] All Phase 1-3 tests still pass
- [ ] Vite + React discovery works against fixture
- [ ] Remix discovery works against fixture
- [ ] SvelteKit discovery works against fixture
- [ ] Astro discovery works against fixture
- [ ] Nuxt discovery works against fixture
- [ ] Generic fallback produces best-effort results
- [ ] Framework detection correctly identifies all supported frameworks
- [ ] `--ci` exits with correct codes for all scenarios
- [ ] `--ci-fail-on` rules work correctly (errors, slow, unprotected, unreachable)
- [ ] `--quiet` produces minimal output
- [ ] Config file `groups`, `ci`, and `discovery` sections work
- [ ] snytch integration shows badges when results exist
- [ ] snytch integration silently ignores when results don't exist
- [ ] JSON schema validates against actual output
- [ ] GitHub Actions example in README is accurate
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no errors
- [ ] Test against at least one real project per framework
- [ ] Bump version to 0.4.0
- [ ] Update README with full framework support matrix

---

## Implementation order

1. Read existing Phases 1-3 codebase thoroughly
2. Refactor discovery interface to `FrameworkDiscoverer` pattern (if not already)
3. Vite + React discovery module + tests
4. Remix discovery module + tests
5. SvelteKit discovery module + tests
6. Astro discovery module + tests
7. Nuxt discovery module + tests
8. React Router SPA module + tests
9. Generic fallback module
10. CI mode (`--ci` flag, exit codes, failure rules)
11. CI output formatting (TTY vs pipe)
12. Config file expansion (groups, ci, discovery sections)
13. `--quiet` flag
14. JSON schema file
15. snytch integration
16. GitHub Actions recipe in README
17. Test fixtures for all frameworks
18. Integration tests for each framework
19. Cross-framework manual testing
20. Bump version, update README with framework matrix
21. Final full test suite run

---

## Critical implementation notes

- **Each framework module must be independently testable.** The fixture approach from Phase 1 scales — each framework gets its own fixture directory with minimal but realistic structure.
- **Normalize everything to the shared types.** Remix uses `:param`, Next.js uses `[param]`, SvelteKit uses `[param]`. Normalize all to `[param]` in the output so the report is consistent regardless of framework.
- **Framework modules should be lazy-loaded.** Don't import all discovery modules upfront — only load the one for the detected framework. This keeps `npx shipmap` startup fast.
- **CI mode is the key to enterprise adoption.** If shipmap can block a deploy on topology regression, it becomes part of the pipeline. Make the exit codes reliable and the output parseable.
- **The snytch integration is intentionally loose.** It reads a JSON file if it exists. If snytch changes its format, shipmap silently ignores it. No hard dependency, no version coupling.
- **The generic fallback should be generous.** Better to show too many possible routes than miss real ones. The confidence labels ("inferred") keep honesty intact.
- **Test against real projects.** The fixtures validate logic, but real projects have edge cases. Before shipping v0.4.0, manually run shipmap against at least one real-world project for each framework. Document any issues found.
- **README framework matrix** should clearly show what's "full support" vs "beta" vs "basic". Next.js is full support. Everything else in Phase 4 launches as beta.
