export type FrameworkType =
  | 'nextjs'
  | 'vite-react'
  | 'remix'
  | 'nuxt'
  | 'sveltekit'
  | 'astro'
  | 'react-router-spa'
  | 'generic';

export type RenderingStrategy = 'SSR' | 'SSG' | 'ISR' | 'Edge' | 'Static' | 'Client' | 'Unknown';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type NodeType = 'page' | 'api' | 'middleware' | 'external';

export type ProbeStatus = 'ok' | 'slow' | 'warn' | 'error' | 'not-probed';

export type ConnectorType = 'call' | 'middleware-coverage' | 'external-dependency' | 'inferred';
export type ConnectorConfidence = 'static' | 'probed' | 'inferred';
export type ConnectorStyle = 'solid' | 'dashed';
export type ConnectorColor = 'green' | 'amber' | 'red' | 'orange' | 'grey' | 'blue';

export interface ProbeResult {
  status: ProbeStatus;
  httpStatus?: number;
  responseTime?: number;
  probedAt?: string;
  methodResults?: Record<HttpMethod, {
    httpStatus: number;
    responseTime: number;
  }>;
}

export interface RouteNode {
  id: string;
  type: 'page' | 'api';
  path: string;
  filePath: string;
  group: string;
  label: string;
  methods?: HttpMethod[];
  rendering?: RenderingStrategy;
  isProtected?: boolean;
  cacheConfig?: string;
  middleware?: string[];
  externals?: string[];
  probe?: ProbeResult;
}

export interface MiddlewareNode {
  id: string;
  type: 'middleware';
  filePath: string;
  label: string;
  group: string;
  matcherPatterns: string[];
  authProvider?: string;
  redirectTarget?: string;
  runtime: 'edge' | 'node';
}

export interface ExternalNode {
  id: string;
  type: 'external';
  name: string;
  label: string;
  group: string;
  host?: string;
  detectedFrom: 'env' | 'import' | 'both';
  referencedBy: string[];
  probe?: {
    reachable: boolean;
    latency?: number;
    probedAt?: string;
  };
}

export type TopologyNode = RouteNode | MiddlewareNode | ExternalNode;

export interface Connector {
  source: string;
  target: string;
  type: ConnectorType;
  confidence: ConnectorConfidence;
  label?: string;
  style: ConnectorStyle;
  color: ConnectorColor;
}

export interface TopologyReport {
  meta: {
    tool: 'shipmap';
    version: string;
    generatedAt: string;
    framework: FrameworkType;
    frameworkVersion?: string;
    projectName: string;
    mode: 'static' | 'probe';
  };
  nodes: TopologyNode[];
  connectors: Connector[];
  groups: Record<string, string[]>;
  summary: {
    totalRoutes: number;
    totalApiRoutes: number;
    totalMiddleware: number;
    totalExternals: number;
    protectedRoutes: number;
    renderingBreakdown: Record<string, number>;
    errors?: number;
  };
}
