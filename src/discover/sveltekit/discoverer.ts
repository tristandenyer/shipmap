import type { FrameworkDiscoverer } from '../types.js';
import { discoverPageRoutes } from './routes.js';
import { discoverApiRoutes } from './api.js';
import { discoverMiddleware } from './middleware.js';
import { discoverExternals } from '../nextjs/externals.js';

export const sveltekitDiscoverer: FrameworkDiscoverer = {
  discoverRoutes: discoverPageRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
