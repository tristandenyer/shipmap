import type { RouteNode } from '../../types.js';

export async function discoverApiRoutes(): Promise<RouteNode[]> {
  // React Router SPA has no server-side API routes
  return [];
}
