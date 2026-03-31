import type { FrameworkDiscoverer } from '../types.js';
import { discoverPageRoutes } from './routes.js';
import { discoverApiRoutes } from './api.js';
import { discoverMiddleware } from './middleware.js';
import { discoverExternals } from './externals.js';

export const nextjsDiscoverer: FrameworkDiscoverer = {
  discoverRoutes: discoverPageRoutes,
  discoverApiRoutes,
  discoverMiddleware,
  discoverExternals,
};
