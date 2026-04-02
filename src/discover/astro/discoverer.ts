import { discoverExternals } from '../nextjs/externals.js';
import type { FrameworkDiscoverer } from '../types.js';
import { discoverApiRoutes } from './api.js';
import { discoverMiddleware } from './middleware.js';
import { discoverRoutes } from './routes.js';

export const astroDiscoverer: FrameworkDiscoverer = {
  discoverRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
