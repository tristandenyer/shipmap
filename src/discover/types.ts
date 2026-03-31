import type { RouteNode, MiddlewareNode, ExternalNode, Connector } from '../types.js';

export interface MiddlewareResult {
  node: MiddlewareNode;
  connectors: Connector[];
}

export interface ExternalsResult {
  nodes: ExternalNode[];
  connectors: Connector[];
}

export interface FrameworkDiscoverer {
  discoverRoutes(projectDir: string): Promise<RouteNode[]>;
  discoverApiRoutes(projectDir: string): Promise<RouteNode[]>;
  discoverMiddleware(projectDir: string, routeNodeIds: Map<string, string>): Promise<MiddlewareResult | null>;
  discoverExternals(projectDir: string, routeFiles: Map<string, string>): Promise<ExternalsResult>;
}
