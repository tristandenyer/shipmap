import { lookup } from 'node:dns/promises';
import type { ExternalNode } from '../types.js';
import { validateProbeUrl, type NetworkSafetyOptions } from './validate.js';

export interface ExternalProbeOptions {
  timeout: number;
  allowInternal?: boolean;
  allowHttp?: boolean;
}

export async function probeExternals(
  nodes: ExternalNode[],
  options: ExternalProbeOptions,
): Promise<ExternalNode[]> {
  const safetyOpts: NetworkSafetyOptions = {
    allowInternal: options.allowInternal,
    allowHttp: options.allowHttp,
  };

  return Promise.all(nodes.map(async (node) => {
    if (!node.host) {
      return {
        ...node,
        probe: {
          reachable: false,
          probedAt: new Date().toISOString(),
        },
      };
    }

    // Extract hostname (strip protocol, port, path)
    let hostname = node.host;
    try {
      const url = new URL(hostname.includes('://') ? hostname : `https://${hostname}`);
      hostname = url.hostname;
    } catch {
      // Use as-is if not parseable
    }

    // Validate resolved IP before making any requests
    const targetUrl = `https://${hostname}`;
    const check = await validateProbeUrl(targetUrl, safetyOpts);
    if (!check.valid) {
      return {
        ...node,
        probe: {
          reachable: false,
          probedAt: new Date().toISOString(),
          blocked: check.reason,
        },
      };
    }

    try {
      const start = performance.now();
      await lookup(hostname);
      const latency = Math.round(performance.now() - start);

      // Try a HEAD request if it looks like an HTTP service
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeout);
        const httpStart = performance.now();
        await fetch(`https://${hostname}`, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timer);
        const httpLatency = Math.round(performance.now() - httpStart);

        return {
          ...node,
          probe: {
            reachable: true,
            latency: httpLatency,
            probedAt: new Date().toISOString(),
          },
        };
      } catch {
        // DNS resolved but HTTP failed — still reachable at DNS level
        return {
          ...node,
          probe: {
            reachable: true,
            latency,
            probedAt: new Date().toISOString(),
          },
        };
      }
    } catch {
      return {
        ...node,
        probe: {
          reachable: false,
          probedAt: new Date().toISOString(),
        },
      };
    }
  }));
}
