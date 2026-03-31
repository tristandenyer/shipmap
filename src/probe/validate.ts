import { lookup } from 'node:dns/promises';

export interface NetworkSafetyOptions {
  allowInternal?: boolean;
  allowHttp?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// IPv4 CIDR ranges to classify
const BLOCKED_ALWAYS = [
  // Link-local / APIPA (includes cloud metadata 169.254.169.254)
  { prefix: [169, 254], bits: 16, label: 'link-local/cloud metadata (169.254.0.0/16)' },
  // "This" network
  { prefix: [0], bits: 8, label: 'reserved (0.0.0.0/8)' },
  // Benchmark testing
  { prefix: [198, 18], bits: 15, label: 'reserved (198.18.0.0/15)' },
  // IETF protocol assignments
  { prefix: [192, 0, 0], bits: 24, label: 'reserved (192.0.0.0/24)' },
  // Documentation ranges (TEST-NET)
  { prefix: [192, 0, 2], bits: 24, label: 'reserved (192.0.2.0/24)' },
  { prefix: [198, 51, 100], bits: 24, label: 'reserved (198.51.100.0/24)' },
  { prefix: [203, 0, 113], bits: 24, label: 'reserved (203.0.113.0/24)' },
  // Class E reserved
  { prefix: [240], bits: 4, label: 'reserved (240.0.0.0/4)' },
];

const BLOCKED_UNLESS_INTERNAL = [
  // RFC 1918 private
  { prefix: [10], bits: 8, label: 'private (10.0.0.0/8)' },
  { prefix: [172, 16], bits: 12, label: 'private (172.16.0.0/12)' },
  { prefix: [192, 168], bits: 16, label: 'private (192.168.0.0/16)' },
  // Carrier-grade NAT (Tailscale, some cloud VPCs)
  { prefix: [100, 64], bits: 10, label: 'CGNAT (100.64.0.0/10)' },
];

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return null;
  return octets;
}

function ipToNumber(octets: number[]): number {
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function prefixToNumber(prefix: number[]): number {
  const padded = [0, 0, 0, 0];
  for (let i = 0; i < prefix.length; i++) padded[i] = prefix[i];
  return ((padded[0] << 24) | (padded[1] << 16) | (padded[2] << 8) | padded[3]) >>> 0;
}

function matchesCidr(octets: number[], prefix: number[], bits: number): boolean {
  const ip = ipToNumber(octets);
  const net = prefixToNumber(prefix);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (net & mask);
}

function isLoopbackV4(octets: number[]): boolean {
  return octets[0] === 127; // 127.0.0.0/8
}

function isIpv6LinkLocal(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower.startsWith('fe80:');
}

function isIpv6UniqueLocal(ip: string): boolean {
  const lower = ip.toLowerCase();
  // fc00::/7 covers fc00:: through fdff::
  return lower.startsWith('fc') || lower.startsWith('fd');
}

function isIpv6Loopback(ip: string): boolean {
  return ip === '::1';
}

function classifyIpv4(
  octets: number[],
  options: NetworkSafetyOptions,
): ValidationResult {
  if (isLoopbackV4(octets)) {
    return { valid: true };
  }

  for (const range of BLOCKED_ALWAYS) {
    if (matchesCidr(octets, range.prefix, range.bits)) {
      return { valid: false, reason: `Blocked: resolves to ${range.label}. This range is never allowed.` };
    }
  }

  if (!options.allowInternal) {
    for (const range of BLOCKED_UNLESS_INTERNAL) {
      if (matchesCidr(octets, range.prefix, range.bits)) {
        return {
          valid: false,
          reason: `Blocked: resolves to ${range.label}. Use --allow-internal to permit probing private IPs.`,
        };
      }
    }
  }

  return { valid: true };
}

function classifyIpv6(ip: string, options: NetworkSafetyOptions): ValidationResult {
  if (isIpv6Loopback(ip)) {
    return { valid: true };
  }
  if (isIpv6LinkLocal(ip)) {
    return { valid: false, reason: 'Blocked: resolves to IPv6 link-local (fe80::/10). This range is never allowed.' };
  }
  if (!options.allowInternal && isIpv6UniqueLocal(ip)) {
    return {
      valid: false,
      reason: 'Blocked: resolves to IPv6 unique-local (fc00::/7). Use --allow-internal to permit probing private IPs.',
    };
  }
  return { valid: true };
}

export async function validateProbeUrl(
  url: string,
  options: NetworkSafetyOptions = {},
): Promise<ValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: `Invalid URL: ${url}` };
  }

  const hostname = parsed.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';

  // Classify IP first — IP-based blocks (metadata, private) take priority over protocol checks
  const v4 = parseIpv4(hostname);
  if (v4) {
    if (!isLoopbackV4(v4)) {
      const ipCheck = classifyIpv4(v4, options);
      if (!ipCheck.valid) return ipCheck;
    }
  } else if (hostname === '::1' || hostname === '[::1]' || hostname.startsWith('[')) {
    const raw = hostname.replace(/^\[|\]$/g, '');
    if (!isIpv6Loopback(raw)) {
      const ipCheck = classifyIpv6(raw, options);
      if (!ipCheck.valid) return ipCheck;
    }
  }

  // Protocol check: block plain HTTP to non-localhost unless opted in
  if (parsed.protocol === 'http:' && !isLocalhost && !options.allowHttp) {
    return {
      valid: false,
      reason: `Blocked: plain HTTP to non-localhost URL. Use HTTPS or add --allow-http to override.`,
    };
  }

  // Skip DNS resolution for localhost — already validated above
  if (isLocalhost) return { valid: true };

  // Resolve hostname to IP and classify
  try {
    const result = await lookup(hostname, { all: true });
    for (const entry of result) {
      const ip = entry.address;
      if (entry.family === 4) {
        const octets = parseIpv4(ip);
        if (octets) {
          const check = classifyIpv4(octets, options);
          if (!check.valid) {
            return { valid: false, reason: `${check.reason} (${hostname} resolved to ${ip})` };
          }
        }
      } else if (entry.family === 6) {
        const check = classifyIpv6(ip, options);
        if (!check.valid) {
          return { valid: false, reason: `${check.reason} (${hostname} resolved to ${ip})` };
        }
      }
    }
  } catch {
    // DNS resolution failed — allow through (the probe itself will fail with a clear error)
  }

  return { valid: true };
}
