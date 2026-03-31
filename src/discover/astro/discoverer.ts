import type { FrameworkDiscoverer } from '../types.js';
import { discoverRoutes } from './routes.js';
import { discoverApiRoutes } from './api.js';
import { discoverMiddleware } from './middleware.js';
import { discoverExternals } from '../nextjs/externals.js';

export const astroDiscoverer: FrameworkDiscoverer = {
  discoverRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
