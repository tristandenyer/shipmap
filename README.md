# shipmap

**Map it before you ship it.**

Auto-discover routes, APIs, middleware, and external services in your Next.js project — generate an interactive HTML topology map.

```
npx shipmap
```

## What it does

shipmap scans your project and produces a self-contained HTML report showing:

- **Page routes** — App Router and Pages Router, with rendering strategy detection (SSR, SSG, ISR, Edge, Static, Client)
- **API routes** — HTTP method detection from exports (`GET`, `POST`, etc.) and `req.method` checks
- **Middleware** — matcher patterns, auth provider detection, redirect targets
- **External services** — detected from env var prefixes and import patterns (Stripe, Supabase, Firebase, AWS, OpenAI, Clerk, Prisma, and more)
- **Connectors** — visual relationships between middleware coverage, route-to-external dependencies

The report is a single `.html` file with zero external dependencies. Open it in any browser.

## Install

```bash
npm install -g shipmap
```

Or run directly:

```bash
npx shipmap
```

## Usage

```bash
# Scan current directory, output shipmap-report.html
shipmap

# Scan a specific project
shipmap ./my-nextjs-app

# Custom output path
shipmap -o topology.html

# JSON output instead of HTML
shipmap --json

# Don't auto-open in browser
shipmap --no-open

# Quiet mode (errors only)
shipmap -q
```

## Interactive report

The HTML report features a dark canvas visualization:

- **Pan** — drag the canvas background
- **Zoom** — scroll wheel
- **Drag nodes** — reposition any node
- **Click a node** — opens detail panel with file path, rendering strategy, methods, connections
- **F** — fit all nodes to view
- **Escape** — close detail panel
- **+/-** — zoom in/out

Nodes are color-coded by type:

| Type | Color |
|------|-------|
| Page | Blue |
| API | Green |
| Middleware | Amber |
| External | Purple |

Rendering strategies show as badges: SSR (red), SSG (green), ISR (amber), Edge (cyan), Static (grey), Client (pink).

## What it detects

### Frameworks

Currently supports **Next.js** (App Router + Pages Router). More frameworks coming in future releases.

### Rendering strategies

| Signal | Strategy |
|--------|----------|
| `'use client'` | Client |
| `runtime = 'edge'` | Edge |
| `dynamic = 'force-dynamic'` | SSR |
| `dynamic = 'force-static'` | SSG |
| `revalidate = N` | ISR |
| `generateStaticParams` | SSG |
| `getServerSideProps` | SSR |
| `getStaticProps` | SSG |
| `cookies()` / `headers()` | SSR |
| Default | Static |

### External services

Detected from `.env` / `.env.local` / `.env.development` prefixes and package imports:

Stripe, Supabase, Firebase, AWS, OpenAI, Anthropic, Resend, SendGrid, Twilio, Cloudinary, Sentry, Redis, Clerk, NextAuth, Prisma, Drizzle, Vercel

`DATABASE_URL` is parsed by protocol: `postgresql://` → PostgreSQL, `mysql://` → MySQL, `mongodb://` → MongoDB.

Env var **values are never included** in the report — only service names.

### Middleware

- Matcher pattern extraction from `export const config`
- Auth provider detection (NextAuth, Clerk, Supabase, Kinde, custom)
- Redirect target detection
- Route coverage connectors

## Programmatic API

```typescript
import { discover, generateReport } from 'shipmap';

const report = await discover('./my-project');
const html = generateReport(report);

// Or use the raw topology data
console.log(report.nodes);
console.log(report.connectors);
console.log(report.summary);
```

## Requirements

- Node.js 18+
- A Next.js project with `package.json`

## License

MIT
