import type { FrameworkDiscoverer } from '../types.js';
import { discoverRoutes } from './routes.js';
import { discoverApiRoutes } from './api.js';
import { discoverExternals } from '../nextjs/externals.js';

async function discoverMiddleware() {
  // React Router SPA has no middleware
  return Promise.resolve(null);
}

export const reactRouterSpaDiscoverer: FrameworkDiscoverer = {
  discoverRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
