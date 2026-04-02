import { discoverExternals } from '../nextjs/externals.js';
import type { FrameworkDiscoverer } from '../types.js';
import { discoverApiRoutes } from './api.js';
import { discoverRoutes } from './routes.js';

async function discoverMiddleware() {
  // Vite/React projects don't have middleware
  return Promise.resolve(null);
}

export const viteReactDiscoverer: FrameworkDiscoverer = {
  discoverRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
