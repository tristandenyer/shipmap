import { discoverExternals } from '../nextjs/externals.js';
import type { FrameworkDiscoverer } from '../types.js';
import { discoverApiRoutes } from './api.js';
import { discoverRoutes } from './routes.js';

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
