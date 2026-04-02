import type { HttpMethod, ProbeStatus, RouteNode } from '../types.js';
import { type NetworkSafetyOptions, validateProbeUrl } from './validate.js';

export interface ProbeOptions {
  baseUrl: string;
  timeout: number;
  concurrency: number;
  headers?: Record<string, string>;
  exclude?: string[];
  allowInternal?: boolean;
  allowHttp?: boolean;
  onProgress?: (current: number, total: number, path: string, status: number, time: number) => void;
}

function matchesExclude(routePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
    if (regex.test(routePath)) return true;
  }
  return false;
}

function classifyStatus(httpStatus: number, responseTime: number): ProbeStatus {
  if (httpStatus === 0) return 'error'; // timeout or connection error
  if (httpStatus >= 500) return 'error';
  if (httpStatus >= 400) return 'error';
  if (responseTime > 2000) return 'slow';
  if (httpStatus >= 200 && httpStatus < 400) return 'ok';
  return 'error';
}

async function probeUrl(
  url: string,
  method: string,
  options: { timeout: number; headers?: Record<string, string> },
): Promise<{ httpStatus: number; responseTime: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout);

  try {
    const fetchOptions: RequestInit = {
      method,
      signal: controller.signal,
      headers: { ...options.headers },
      redirect: 'follow',
    };

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = '{}';
      (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const start = performance.now();
    const response = await fetch(url, fetchOptions);
    const responseTime = Math.round(performance.now() - start);
    return { httpStatus: response.status, responseTime };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { httpStatus: 0, responseTime: options.timeout };
    }
    return { httpStatus: 0, responseTime: 0 };
  } finally {
    clearTimeout(timer);
  }
}

// Simple semaphore for concurrency limiting
function createSemaphore(max: number) {
  let current = 0;
  const queue: Array<() => void> = [];

  return {
    async acquire(): Promise<void> {
      if (current < max) {
        current++;
        return;
      }
      return new Promise<void>((resolve) => {
        queue.push(() => {
          current++;
          resolve();
        });
      });
    },
    release(): void {
      current--;
      const next = queue.shift();
      if (next) next();
    },
  };
}

export async function probeRoutes(nodes: RouteNode[], options: ProbeOptions): Promise<RouteNode[]> {
  const safetyOpts: NetworkSafetyOptions = {
    allowInternal: options.allowInternal,
    allowHttp: options.allowHttp,
  };
  const check = await validateProbeUrl(options.baseUrl, safetyOpts);
  if (!check.valid) {
    throw new Error(`Probe URL blocked: ${check.reason}`);
  }

  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const sem = createSemaphore(options.concurrency);
  const exclude = options.exclude || [];
  let completed = 0;
  const total = nodes.length;

  const probed = await Promise.all(
    nodes.map(async (node) => {
      if (matchesExclude(node.path, exclude)) {
        completed++;
        return {
          ...node,
          probe: {
            status: 'not-probed' as ProbeStatus,
            probedAt: new Date().toISOString(),
          },
        };
      }

      await sem.acquire();
      try {
        const url = `${baseUrl}${node.path}`;

        if (node.type === 'api' && node.methods && node.methods.length > 0) {
          // Probe each method for API routes
          const methodResults: Partial<Record<HttpMethod, { httpStatus: number; responseTime: number }>> = {};
          let worstStatus: ProbeStatus = 'ok';
          let primaryHttp = 200;
          let primaryTime = 0;

          for (const method of node.methods) {
            const result = await probeUrl(url, method, {
              timeout: options.timeout,
              headers: options.headers,
            });
            methodResults[method] = result;
            const status = classifyStatus(result.httpStatus, result.responseTime);
            if (status === 'error') worstStatus = 'error';
            else if (status === 'slow' && worstStatus !== 'error') worstStatus = 'slow';
            if (method === 'GET' || primaryHttp === 200) {
              primaryHttp = result.httpStatus;
              primaryTime = result.responseTime;
            }
          }

          completed++;
          options.onProgress?.(completed, total, node.path, primaryHttp, primaryTime);

          return {
            ...node,
            probe: {
              status: worstStatus,
              httpStatus: primaryHttp,
              responseTime: primaryTime,
              probedAt: new Date().toISOString(),
              methodResults: methodResults as Record<HttpMethod, { httpStatus: number; responseTime: number }>,
            },
          };
        } else {
          // Simple GET for page routes
          const result = await probeUrl(url, 'GET', {
            timeout: options.timeout,
            headers: options.headers,
          });
          const status = classifyStatus(result.httpStatus, result.responseTime);
          completed++;
          options.onProgress?.(completed, total, node.path, result.httpStatus, result.responseTime);

          return {
            ...node,
            probe: {
              status,
              httpStatus: result.httpStatus,
              responseTime: result.responseTime,
              probedAt: new Date().toISOString(),
            },
          };
        }
      } finally {
        sem.release();
      }
    }),
  );

  return probed;
}
