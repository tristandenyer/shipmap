# shipmap demo

A sample Next.js app designed to exercise shipmap's discovery features. This is not a working application. It exists so you can run `shipmap` against it and see a realistic service map.

![Pages discovered by shipmap](../docs/images/shipmap-pages.png)

## What's included

- **9 page routes** with a mix of rendering strategies (Static, Client, SSR, SSG, ISR, Edge)
- **5 API routes** with multiple HTTP methods (GET, POST, PUT, DELETE)
- **Middleware** with Clerk auth, route protection, and redirect logic
- **8 external services** detected from `.env.local` and imports (Clerk, PostgreSQL, Stripe, OpenAI, Resend, Sentry, PostHog, Uploadthing)
- **Route groups** `(marketing)` and **dynamic segments** `[slug]`, `[id]`, `[teamId]`

![API routes discovered by shipmap](../docs/images/shipmap-apis.png)

## Run it

From the `demo/` directory:

```bash
# Option 1: run shipmap directly
node ../bin/shipmap.js

# Option 2: with verbose output
node ../bin/shipmap.js --verbose

# Option 3: JSON output
node ../bin/shipmap.js --json
```

![External services discovered by shipmap](../docs/images/shipmap-externals.png)

No `npm install` is needed. shipmap reads source files and `package.json` directly.
