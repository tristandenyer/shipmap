import type { FrameworkDiscoverer } from '../types.js';
import { discoverRoutes } from './routes.js';
import { discoverApiRoutes } from './api.js';
import { discoverExternals } from '../nextjs/externals.js';

async function discoverMiddleware() {
  // Generic apps don't have a standard middleware pattern
  return Promise.resolve(null);
}

export const genericDiscoverer: FrameworkDiscoverer = {
  discoverRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
