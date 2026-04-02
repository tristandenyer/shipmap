import type { FrameworkDiscoverer } from '../types.js';
import { discoverApiRoutes } from './api.js';
import { discoverExternals } from './externals.js';
import { discoverMiddleware } from './middleware.js';
import { discoverPageRoutes } from './routes.js';

export const nextjsDiscoverer: FrameworkDiscoverer = {
  discoverRoutes: discoverPageRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
