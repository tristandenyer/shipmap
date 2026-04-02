import { discoverExternals } from '../nextjs/externals.js';
import type { FrameworkDiscoverer } from '../types.js';
import { discoverApiRoutes } from './api.js';
import { discoverMiddleware } from './middleware.js';
import { discoverPageRoutes } from './routes.js';

export const sveltekitDiscoverer: FrameworkDiscoverer = {
  discoverRoutes: discoverPageRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
