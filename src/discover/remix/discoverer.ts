import type { FrameworkDiscoverer, MiddlewareResult, ExternalsResult } from '../types.js';
import { discoverRoutes } from './routes.js';
import { discoverApiRoutes } from './api.js';
import { discoverExternals } from '../nextjs/externals.js';

export const remixDiscoverer: FrameworkDiscoverer = {
  discoverRoutes,
  discoverApiRoutes,
  discoverMiddleware: async () => null, // Remix doesn't have traditional middleware
  discoverExternals,
};
