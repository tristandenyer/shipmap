import { discoverExternals } from '../nextjs/externals.js';
import type { FrameworkDiscoverer } from '../types.js';
import { discoverApiRoutes } from './api.js';
import { discoverRoutes } from './routes.js';

export const remixDiscoverer: FrameworkDiscoverer = {
  discoverRoutes,
  discoverApiRoutes,
  discoverMiddleware: async () => null, // Remix doesn't have traditional middleware
  discoverExternals,
};
