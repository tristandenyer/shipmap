# Phase 3 Super-Prompt — "Power User"

> Paste this entire prompt into Claude Code to build shipmap v0.3.0. Phases 1 and 2 must be complete first.

---

## Context

You are continuing work on **shipmap** — "Map it before you ship it." Phases 1-2 are complete: static discovery, interactive HTML report, probe mode with live status, auth auto-detection, watch mode with live reload.

Phase 3 adds the **power user features** that turn shipmap from a useful tool into an essential one: diff mode, keyboard shortcuts, search & filter, clipboard operations, Markdown export, and stale warnings. These are the features that make developers evangelize the tool to their team.

The project is at `/Users/tristandenyer/Documents/github/shipmap`. Read the master plan at `/Users/tristandenyer/Documents/github/shipmap-plan.md`.

**IMPORTANT:** Before making changes, read the existing codebase thoroughly. Understand what Phases 1-2 built. Extend, don't rewrite. Every existing test must continue to pass.

---

## What to build

### 1. Diff mode (`--diff` flag)

Add CLI flag:
```
--diff     Compare current topology to previous run, highlight changes
```

**`src/diff/compare.ts`:**

```typescript
export interface DiffResult {
  added: TopologyNode[];           // New routes not in previous run
  removed: TopologyNode[];         // Routes in previous run but gone now
  changed: Array<{
    node: TopologyNode;
    changes: string[];             // Human-readable change descriptions
    previousProbe?: ProbeResult;
    currentProbe?: ProbeResult;
  }>;
  unchanged: TopologyNode[];
  summary: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
  };
}

export function compareTopolgy(
  current: TopologyReport,
  previous: TopologyReport
): DiffResult
```

**Comparison logic:**
- Match nodes by `path` (not ID, since IDs may regenerate)
- A node is "added" if its path exists in current but not previous
- A node is "removed" if its path exists in previous but not current
- A node is "changed" if any of these differ:
  - HTTP status (probe mode)
  - Response time changed by >50% (probe mode)
  - Rendering strategy changed
  - HTTP methods added/removed (API routes)
  - Auth status changed (protected ↔ public)
  - New middleware coverage
  - New external service references
- Generate human-readable change descriptions:
  - "Status changed: 200 → 500"
  - "Response time increased: 45ms → 2340ms"
  - "Rendering changed: SSG → SSR"
  - "Now protected by middleware"
  - "New external dependency: Stripe"

**Loading previous report:**
- Read `.shipmap/last-report.json` (saved by Phase 2 at end of each run)
- If no previous report exists, show: "No previous report found. Run shipmap once first, then use --diff on subsequent runs."

**HTML report diff visualization:**
- New nodes: green glow + "NEW" badge in top-right corner of node
- Removed nodes: rendered as "ghost" nodes — translucent (opacity 0.3), strikethrough text on route path, red-tinted, not interactive (no click, no drag)
- Changed nodes: amber border pulse animation + change indicator icon
- In detail panel for changed nodes: show "Changes since last run" section with before → after values
- Toolbar diff summary: `"+3 new · -1 removed · 2 changed · 41 unchanged"`
- Diff legend in toolbar (small, non-intrusive)

**Connector diff:**
- New connectors: green, slightly thicker
- Removed connectors: red, dashed, opacity 0.3
- Existing connectors: normal rendering

### 2. Keyboard shortcuts

Add keyboard event handling to the HTML report. All shortcuts work when focus is not in a text input.

| Key | Action | Implementation |
|---|---|---|
| `F` | Fit all nodes to viewport | Calculate bounding box of all visible nodes, set transform to center and scale to fit with 10% padding |
| `Escape` | Close detail panel / close search / deselect node | Check what's open, close in priority order: search → panel → deselect |
| `/` | Focus search bar | Prevent default `/` behavior, focus the search input, select all text if any |
| `↑` `↓` | Navigate between nodes | Move selection to prev/next node in the currently visible (filtered) list. Scroll canvas to keep selected node in view |
| `←` `→` | Navigate between groups | Move selection to the first node in the prev/next group |
| `Enter` | Open detail panel for selected node | Same as clicking the node |
| `C` | Copy selected node's route path to clipboard | Copy path, show brief toast: "Copied /api/users" |
| `O` | Open selected route in browser | Open `baseUrl + path` in new tab (probe mode only). Show toast if not in probe mode: "Open in browser requires --probe mode" |
| `G` | Toggle collapse/expand of selected node's group | If node is in a group, toggle that group |
| `?` | Toggle keyboard shortcut overlay | Show/hide a semi-transparent overlay listing all shortcuts |
| `1` | Filter: show all | Reset all filters |
| `2` | Filter: pages only | Show only page nodes |
| `3` | Filter: API routes only | Show only API nodes |
| `4` | Filter: errors only | Show only nodes with error status (probe mode) |

**Keyboard shortcut overlay (`?`):**
- Fixed position, centered, semi-transparent dark background
- Two-column grid layout listing all shortcuts
- Click anywhere or press `?` again to dismiss
- Shows only shortcuts relevant to current mode (e.g., hide probe-only shortcuts in static mode)

**Node selection state:**
- Selected node has a visible focus ring (2px cyan outline)
- Selection is independent of detail panel (you can select a node without opening its panel)
- `Enter` opens the panel for the selected node
- Arrow key navigation wraps around (last → first)

### 3. Search & filter

**Search bar:**
- Located in the toolbar (right side, before timestamp)
- Input field with magnifying glass icon and "Search routes... (/)" placeholder
- As user types, filter nodes in real-time:
  - Match against: route path, node label, file path, external service name
  - Case-insensitive substring match
  - Matching nodes remain fully visible
  - Non-matching nodes fade to 20% opacity
  - Connectors to/from non-matching nodes also fade
- Clear button (`×`) resets search
- `Escape` clears search and blurs input
- Show match count: "12 of 47 routes"

**Filter buttons:**
- Row of toggle buttons below the toolbar (or integrated into toolbar):
  - **Type filters:** All | Pages | API | Middleware | External
  - **Status filters (probe mode only):** All | OK | Slow | Errors
  - **Rendering filters:** All | SSR | SSG | ISR | Edge | Static | Client
- Filters are combinable (AND logic): selecting "Pages" + "SSR" shows only SSR pages
- Active filters highlighted with accent color
- Filter state encoded in URL hash: `#filter=type:page,status:error`
  - This means you can share a filtered view URL
  - On load, parse hash and apply filters

**Visual feedback:**
- Filtered-out nodes fade to 20% opacity (not hidden entirely — preserves spatial context)
- Filtered-out connectors fade to 10% opacity
- Group headers show filtered count: "dashboard (3 of 7)"
- If all nodes in a group are filtered out, collapse the group automatically

### 4. Copy route path to clipboard

- Small copy icon (📋 or SVG clipboard icon) on each node, top-right corner
- Click copies the route path to clipboard: `/api/users`
- Show toast notification: `"Copied: /api/users"` (auto-dismiss after 2 seconds)
- Also works via keyboard shortcut `C` on selected node
- Uses `navigator.clipboard.writeText()` with fallback to `document.execCommand('copy')` for older browsers

**Toast notification system:**
- Fixed position, bottom-center of viewport
- Dark background with white text, rounded corners
- Slide-up animation on show, fade-out on dismiss
- Stack multiple toasts if they come in quick succession (max 3 visible)

### 5. Open in browser

- Small external-link icon on page and API nodes
- Click opens `baseUrl + route path` in a new tab
- Only visible in probe mode (when baseUrl is known)
- In static mode: icon is grey/disabled with tooltip "Run with --probe to enable"
- Also works via keyboard shortcut `O` on selected node
- For API routes, opens the route with the first detected method (usually GET)

### 6. Stale snapshot warning

When the HTML file is opened in a browser, check how old the snapshot is:

```javascript
const generatedAt = new Date(REPORT_DATA.meta.generatedAt);
const now = new Date();
const hoursOld = (now - generatedAt) / (1000 * 60 * 60);

if (hoursOld > 4) {
  showStaleBanner(hoursOld);
}
```

**Stale banner:**
- Fixed position, top of viewport, full width
- Yellow/amber background with dark text
- Message: `"⏰ This snapshot is X hours old. Re-run 'npx shipmap' for fresh data."`
  - If >24h: `"X days old"`
  - If >168h (1 week): `"over a week old"`
- Dismissible (×) button — dismissed state stored in `sessionStorage` so it doesn't nag on every interaction
- Does not appear if snapshot is <4 hours old

### 7. Copy as Markdown

Add CLI flag:
```
--markdown     Output topology as a Markdown table to stdout
```

Also add a "Copy as Markdown" button in the HTML report toolbar.

**Markdown format:**

```markdown
# shipmap — Project Name
> Generated: 2026-03-23T10:00:00Z | Framework: Next.js 14.2.0 | Mode: Probe

## Pages (23)
| Route | Rendering | Status | Response Time | Auth | Cache |
|-------|-----------|--------|---------------|------|-------|
| `/` | SSG | 200 ✓ | 12ms | Public | revalidate:3600 |
| `/dashboard` | SSR | 200 ✓ | 145ms | Protected | no-store |
| `/dashboard/settings` | Client | 200 ✓ | 89ms | Protected | — |

## API Routes (15)
| Route | Methods | Status | Response Time | Auth |
|-------|---------|--------|---------------|------|
| `/api/users` | GET, POST | 200, 201 | 34ms, 128ms | Protected |
| `/api/auth/[...nextauth]` | GET, POST | 200, 200 | 23ms, 45ms | Public |

## Middleware (1)
| File | Matches | Auth Provider | Runtime |
|------|---------|---------------|---------|
| `middleware.ts` | `/dashboard/*` | NextAuth | Edge |

## External Services (3)
| Service | Detected From | Reachable | Latency | Used By |
|---------|--------------|-----------|---------|---------|
| Stripe | env + import | ✓ | 23ms | 4 routes |
| PostgreSQL | env | ✓ | 5ms | 12 routes |
| Redis | env | ✗ | — | 3 routes |

## Summary
- **47 routes** (23 pages, 15 API, 1 middleware, 3 external services)
- **35 OK**, 3 slow, 2 errors, 7 not probed
- Auth: NextAuth (12 protected routes)
```

**In-browser Markdown copy:**
- Button in toolbar: "📋 Copy Markdown"
- Generates the same format from `REPORT_DATA`
- Copies to clipboard
- Shows toast: "Copied topology as Markdown"

### 8. Previous report archival

Enhance the `.shipmap/` directory:
- `.shipmap/last-report.json` — most recent (overwritten each run)
- `.shipmap/history/` — timestamped copies:
  - `.shipmap/history/2026-03-23T10-00-00.json`
  - Keep last 10 reports, auto-delete older ones
- `--diff` uses `.shipmap/last-report.json` by default
- `--diff-from <path>` allows comparing against a specific historical report

### 9. Update CLI

```
shipmap [options]

New options for Phase 3:
  --diff                  Compare to previous run and highlight changes
  --diff-from <path>      Compare to a specific previous report JSON
  --markdown              Output topology as Markdown table
```

### 10. Tests

**`test/diff.test.ts`:**
- Detects added routes
- Detects removed routes
- Detects status changes
- Detects rendering strategy changes
- Detects method changes on API routes
- Handles first run (no previous report) gracefully
- Generates correct human-readable change descriptions
- Diff HTML shows correct badges (NEW, ghost, changed)

**`test/keyboard.test.ts`:**
- Not unit-testable in the traditional sense (browser JS)
- Instead: test that the generated HTML contains the keyboard event handler code
- Test that shortcut overlay HTML is present
- Test that all documented shortcuts have corresponding handler code

**`test/search.test.ts`:**
- Similarly: test that search/filter HTML and JS are present in output
- Test that filter state serializes to URL hash correctly
- Test Markdown output format against expected structure

**`test/markdown.test.ts`:**
- `--markdown` outputs correct Markdown for fixture project
- Markdown includes all route types
- Markdown renders correctly when pasted into GitHub issue (validate no broken tables)
- Status symbols are correct (✓, ✗, ⚠)

---

## Build & quality checklist

Before considering Phase 3 complete:

- [ ] All Phase 1 and Phase 2 tests still pass
- [ ] `--diff` correctly identifies added, removed, and changed routes
- [ ] Diff visualization in HTML is clear and intuitive
- [ ] All keyboard shortcuts work in Chrome, Firefox, Safari
- [ ] Keyboard shortcut overlay (`?`) shows correct shortcuts
- [ ] Search filters nodes in real-time with correct fade behavior
- [ ] Type/status/rendering filter buttons work and combine correctly
- [ ] Filter state is preserved in URL hash
- [ ] Copy route path works and shows toast
- [ ] Open in browser works in probe mode, disabled in static mode
- [ ] Stale warning shows after 4+ hours, dismissible
- [ ] `--markdown` outputs correct Markdown table
- [ ] In-browser "Copy Markdown" button works
- [ ] Report archival saves to `.shipmap/history/`
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no errors
- [ ] Bump version to 0.3.0

---

## Implementation order

1. Read existing Phases 1-2 codebase thoroughly
2. Diff comparison logic (`src/diff/compare.ts`)
3. Diff CLI flag + integration
4. Diff visualization in HTML (badges, ghost nodes, changed highlights)
5. Keyboard shortcut system in HTML template
6. Shortcut overlay
7. Search bar + real-time filtering
8. Filter buttons (type, status, rendering)
9. URL hash filter state
10. Copy to clipboard (route path)
11. Toast notification system
12. Open in browser button
13. Stale snapshot warning
14. Markdown export (CLI flag + in-browser button)
15. Report archival (`.shipmap/history/`)
16. Tests for all new features
17. Cross-browser manual testing (Chrome, Firefox, Safari)
18. Bump version, update README with new features

---

## Critical implementation notes

- **Keyboard shortcuts must not conflict with browser defaults.** That's why we use single keys (F, C, G) rather than Ctrl+combinations. All shortcuts are disabled when focus is in the search input.
- **The search must be fast.** For 100+ nodes, linear scan is fine. Don't over-engineer with fuzzy matching — exact substring is what developers expect.
- **Filters should feel instant.** Use CSS opacity transitions (150ms) for the fade effect. Don't remove DOM nodes — just fade them. This preserves layout stability.
- **The diff algorithm matches on route path, not node ID.** IDs are regenerated each run. Paths are the stable identifier.
- **Ghost nodes (removed routes) are important UX.** They show what's gone, in the position it used to occupy. This gives spatial context. Without ghost nodes, the user has to mentally diff two layouts.
- **The Markdown export is for PR descriptions.** It needs to paste cleanly into GitHub, Notion, or Linear. Test it by actually pasting into a GitHub comment and checking the rendering.
- **Stale warning uses local time comparison.** Be aware of timezone edge cases — use UTC throughout. The `generatedAt` in the report is ISO 8601 UTC.
