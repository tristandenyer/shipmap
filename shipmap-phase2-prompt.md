# Phase 2 Super-Prompt — "Sticky"

> Paste this entire prompt into Claude Code to build shipmap v0.2.0. Phase 1 must be complete first.

---

## Context

You are continuing work on **shipmap** — "Map it before you ship it." Phase 1 (v0.1.0) is complete: static discovery works for Next.js, the interactive HTML report generates correctly.

Phase 2 adds **probe mode** (real HTTP requests to a running app) and **watch mode** (live-refreshing map during development). These are the features that make developers keep shipmap installed. The project is at `/Users/tristandenyer/Documents/github/shipmap`.

Read the master plan at `/Users/tristandenyer/Documents/github/shipmap-plan.md` for architecture context and shared types.

**IMPORTANT:** Before making changes, read the existing codebase thoroughly. Understand what Phase 1 built. Extend, don't rewrite.

---

## What to build

### 1. Probe mode (`--probe` flag)

Add new CLI flags:
```
--probe               Enable HTTP probing of discovered routes
--probe-url <url>     Base URL to probe (default: http://localhost:3000)
--probe-timeout <ms>  Request timeout per route (default: 10000)
--probe-concurrency <n>  Max concurrent requests (default: 5)
```

**`src/probe/http.ts`** — HTTP prober:

```typescript
export async function probeRoutes(
  nodes: RouteNode[],
  options: { baseUrl: string; timeout: number; concurrency: number; headers?: Record<string, string> }
): Promise<RouteNode[]>
```

- Uses `undici` (built into Node 18+ via `fetch`) or native `fetch` for HTTP requests
- For page routes: send GET request, record status code + response time
- For API routes: probe each detected method (GET, POST, etc.)
  - POST/PUT/PATCH: send empty JSON body `{}` with `Content-Type: application/json`
  - Record status + response time per method
- Classify results:
  - 200-299 → `'ok'`, color: green
  - 300-399 → `'ok'` (redirects are normal), color: green
  - 400-499 → `'error'`, color: red
  - 500-599 → `'error'`, color: red
  - Response time > 2000ms → `'slow'`, color: amber (overrides ok)
  - Timeout → `'error'`, color: red, httpStatus: 0
- Run with concurrency limiter (simple semaphore pattern, no external dep)
- Show progress: `Probing... [12/47] /api/users (200 OK, 45ms)`
- Skip routes matching patterns in `shipmap.config.js` exclude list

**`src/probe/external.ts`** — External service reachability:

```typescript
export async function probeExternals(
  nodes: ExternalNode[],
  options: { timeout: number }
): Promise<ExternalNode[]>
```

- For each external service with a known host:
  - DNS resolve the hostname
  - If resolvable, attempt TCP connection (or simple HEAD request)
  - Record: reachable (boolean) + latency
- IMPORTANT: "reachable" means the host responds to a connection. It does NOT mean the integration works. The report must say "host reachable" not "service working."
- For services without a known host (detected from imports only), skip probe, mark as "host unknown"

### 2. Auth auto-detection (`src/probe/auth.ts`)

```typescript
export async function detectAuth(
  projectDir: string
): Promise<{ provider: string; headers: Record<string, string> } | null>
```

Read `.env.local` (and `.env`, `.env.development` as fallbacks) and detect auth configuration:

**NextAuth / Auth.js:**
- Detected by: `NEXTAUTH_SECRET` env var
- Action: Generate a mock session token. Use `NEXTAUTH_SECRET` to sign a JWT with a test payload:
  ```json
  { "sub": "shipmap-probe", "name": "Shipmap Probe", "email": "probe@shipmap.dev" }
  ```
- Set header: `Cookie: next-auth.session-token=<signed-jwt>`

**Clerk:**
- Detected by: `CLERK_SECRET_KEY` env var
- Action: Use the Clerk Backend API to create a testing token (or document that the user should provide a test JWT in config)
- Since calling Clerk API requires specific setup, default to: log a message asking user to add `probe.headers` to `shipmap.config.js` with a valid Clerk JWT
- Set header if provided

**Supabase:**
- Detected by: `SUPABASE_SERVICE_ROLE_KEY` env var
- Action: Set header: `Authorization: Bearer <service-role-key>`
- Also set `apikey: <supabase-anon-key>` if `NEXT_PUBLIC_SUPABASE_ANON_KEY` is present

**Basic Auth:**
- Detected by: `BASIC_AUTH_USER` + `BASIC_AUTH_PASSWORD` env vars
- Action: `Authorization: Basic <base64(user:password)>`

**Config file override:**
- If `shipmap.config.js` exists with `probe.headers`, those take precedence over auto-detection
- This is the escape hatch for any auth system we don't auto-detect

**Security requirements:**
- NEVER log full token values. Log only: "Auth detected: NextAuth (session token generated)"
- NEVER write token values to the HTML report
- Only the auth PROVIDER NAME appears in the report (e.g., "Protected by NextAuth")

### 3. Config file support (`shipmap.config.js`)

Look for `shipmap.config.js` or `shipmap.config.mjs` in the project root. ESM only (`export default`).

```javascript
// shipmap.config.js
export default {
  probe: {
    baseUrl: 'https://staging.yourapp.com',
    headers: {
      Authorization: 'Bearer your-test-token',
      'X-Custom-Header': 'value'
    },
    exclude: ['/api/internal/*', '/api/webhooks/*'],
    timeout: 15000,
    concurrency: 3,
  }
}
```

Load with dynamic `import()`. If file doesn't exist, use defaults. Config values are overridden by CLI flags (CLI flags take precedence).

### 4. Update HTML report for probe data

The report template needs significant updates to show live data:

**Node status indicators:**
- Replace grey dots with colored status dots:
  - Green dot + green border glow: 200 OK
  - Amber dot + amber border glow: slow response (>2s)
  - Red dot + red border glow: 4xx/5xx error
  - Blue dot: external service
  - Grey dot: not probed (static mode)
- Show HTTP status code on the node: `200` in small text
- Show response time: `45ms` in small text

**Connector updates:**
- Probed routes get solid connectors (confidence: `'probed'`)
- Static-only routes keep dashed connectors (confidence: `'static'`)
- Connector color matches the status of the target node

**API route method results:**
- In the detail panel, show per-method results:
  ```
  GET  → 200 OK (34ms)
  POST → 201 Created (128ms)
  DELETE → 403 Forbidden (12ms) ⚠️
  ```
- Color each method result by status

**External service nodes:**
- Show "Host reachable" (green) or "Host unreachable" (red) or "Host unknown" (grey)
- Show latency if reachable
- Show count of referencing routes

**Toolbar updates:**
- Show mode: "Static mode" or "Probe mode"
- In probe mode, show summary: "32 OK, 3 errors, 2 slow, 10 not probed"
- Show base URL that was probed

**Detail panel updates for probe data:**
- Response time with color coding
- Full HTTP status with status text
- For errors: show the status code prominently in red
- "Last probed: [timestamp]"

### 5. Watch mode (`--serve` flag)

Add CLI flag:
```
--serve [port]     Start live server with auto-refresh (default port: 3001)
```

**`src/serve/watcher.ts`:**

```typescript
export async function startWatchServer(options: {
  projectDir: string;
  port: number;
  probeEnabled: boolean;
  probeOptions?: ProbeOptions;
}): Promise<void>
```

Implementation:
- Use `chokidar` to watch:
  - `app/**/*` (App Router)
  - `pages/**/*` (Pages Router)
  - `src/**/*` (if src directory exists)
  - `middleware.ts` / `middleware.js`
  - `.env.local`
  - `shipmap.config.js`
  - `next.config.js` / `next.config.mjs`
- On file change (debounced 500ms):
  1. Re-run discovery
  2. If `--probe` also active, re-probe changed routes only (not all routes)
  3. Regenerate report HTML
  4. Push update to connected browsers via SSE (Server-Sent Events)
- Start a simple HTTP server (Node built-in `http` module):
  - `GET /` → serve the report HTML
  - `GET /events` → SSE endpoint for live reload
  - `GET /api/topology` → serve raw JSON topology
- Inject a small SSE client script into the HTML that auto-reconnects and reloads on update
- Print: `shipmap live at http://localhost:3001 — watching for changes...`
- Ctrl+C gracefully shuts down watcher + server

**Smart re-probing:**
- Track which files changed
- Map changed files to affected routes
- Only re-probe affected routes (not the entire app)
- Merge with previous probe results for unchanged routes
- Store probe cache in `.shipmap/probe-cache.json`

### 6. Probe result caching

Create `.shipmap/` directory in project root:
- `.shipmap/probe-cache.json` — cached probe results with timestamps
- `.shipmap/last-report.json` — last topology JSON (used by Phase 3 diff)
- Add `.shipmap/` to suggested `.gitignore` entries in README

Cache structure:
```json
{
  "probeUrl": "http://localhost:3000",
  "probedAt": "2026-03-23T10:00:00Z",
  "routes": {
    "/dashboard": { "status": 200, "responseTime": 45, "probedAt": "..." },
    "/api/users:GET": { "status": 200, "responseTime": 34, "probedAt": "..." }
  }
}
```

On subsequent runs with `--probe`, show cached results for routes that haven't changed, and re-probe routes where the source file has been modified since last probe.

### 7. Update CLI flow

Updated CLI flow for Phase 2:

```
shipmap [options]

Options:
  -d, --dir <path>           Target project directory (default: cwd)
  -o, --out <path>           Output file path (default: ./shipmap-report.html)
  --json                     Output topology as JSON to stdout
  --no-open                  Don't auto-open the report in browser
  --probe                    Enable HTTP probing
  --probe-url <url>          Base URL to probe (default: http://localhost:3000)
  --probe-timeout <ms>       Request timeout (default: 10000)
  --probe-concurrency <n>    Max concurrent probes (default: 5)
  --serve [port]             Start live server (default port: 3001)
  --verbose                  Show detailed output
  -V, --version              Output version
  -h, --help                 Show help
```

Flow:
1. Detect framework
2. Run discovery
3. If `--probe`: detect auth → probe routes → probe externals
4. If `--serve`: start watcher + server (combine with `--probe` for live probed map)
5. Else: generate HTML, write file, open browser
6. Save topology to `.shipmap/last-report.json`

Console output for probe mode:
```
shipmap v0.2.0 — Map it before you ship it.

Framework: Next.js 14.2.0
Auth: NextAuth detected (session token generated)
Base URL: http://localhost:3000

Discovering routes... 47 routes found
Probing routes... [████████████████████░░] 38/47
  ✓ 32 OK
  ⚠ 3 slow (>2s)
  ✗ 2 errors
  ○ 10 not probed (excluded)

Probing external services...
  ✓ Stripe: host reachable (23ms)
  ✓ PostgreSQL: host reachable (5ms)
  ✗ Redis: host unreachable

Report: ./shipmap-report.html
```

### 8. Add `chokidar` and update dependencies

Add to dependencies:
- `chokidar` (file watching for `--serve` mode)

No other new dependencies. Use Node built-in `http` for the serve server. Use native `fetch` (Node 18+) for probing.

### 9. Tests

**`test/probe.test.ts`:**
- Probes a mock HTTP server with known responses
- Classifies status correctly (ok, slow, error)
- Respects timeout
- Respects concurrency limit
- Records response times
- Handles connection refused gracefully
- Handles timeout gracefully

**`test/auth.test.ts`:**
- Detects NextAuth from env vars
- Detects Supabase from env vars
- Detects Basic Auth from env vars
- Falls back to config file
- Config file overrides auto-detection
- Never leaks token values in output

**`test/serve.test.ts`:**
- Server starts and serves HTML on specified port
- SSE endpoint sends events
- File change triggers rebuild
- Server shuts down cleanly

**`test/config.test.ts`:**
- Loads ESM config file
- Handles missing config file gracefully
- CLI flags override config values
- Invalid config shows helpful error

Update existing tests:
- `test/report.test.ts` — verify probe data renders correctly in HTML
- `test/cli.test.ts` — test new flags

---

## Build & quality checklist

Before considering Phase 2 complete:

- [ ] All Phase 1 tests still pass
- [ ] `shipmap --probe -d test/fixtures/nextjs-app-router` works against a running Next.js dev server
- [ ] Probe results show correct status codes and response times
- [ ] Auth auto-detection works for NextAuth (test with a real NextAuth project if available)
- [ ] Config file loading works
- [ ] HTML report shows colored status indicators when probed
- [ ] Connectors are solid (probed) vs dashed (static)
- [ ] Detail panel shows per-method probe results for API routes
- [ ] `--serve` starts a live server that auto-refreshes on file changes
- [ ] `--serve --probe` re-probes only changed routes
- [ ] Probe cache works (subsequent runs are faster)
- [ ] `.shipmap/` directory created with correct files
- [ ] No env var values or tokens appear in HTML output
- [ ] No secrets logged in verbose mode (only provider names)
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no errors
- [ ] Bump version to 0.2.0

---

## Implementation order

1. Read existing Phase 1 codebase thoroughly
2. Add `chokidar` dependency
3. Config file loader (`shipmap.config.js`)
4. Auth auto-detection
5. HTTP prober for routes
6. External service prober
7. Probe result caching (`.shipmap/`)
8. Update CLI with new flags
9. Update HTML report template for probe data (status colors, response times)
10. Update detail panel for probe-specific views
11. Update toolbar for probe mode
12. Update connector rendering (solid vs dashed based on confidence)
13. Watch mode: file watcher + SSE server
14. Smart re-probing (only changed routes)
15. Tests for all new modules
16. Integration test: full probe workflow
17. Manual test against a real Next.js project
18. Bump version, update README

---

## Critical implementation notes

- The prober must be resilient. Connection refused, DNS failures, timeouts, SSL errors — all must be caught and reported gracefully, never crash the CLI.
- Probe mode should feel fast. Use concurrency, show a progress bar, cache results.
- The auth detection is best-effort and should ALWAYS suggest `shipmap.config.js` as the manual override. Don't promise it works perfectly — auth is messy.
- Watch mode must debounce aggressively. File saves often trigger multiple filesystem events. Use 500ms debounce minimum.
- The SSE reconnection in the browser should be automatic with a small delay (1s). If the server restarts, the browser should reconnect seamlessly.
- Do NOT add `chokidar` as a peerDependency. It's a regular dependency — `npx shipmap` must work without manual installs.
