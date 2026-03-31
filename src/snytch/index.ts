import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SnytchFinding {
  filePath: string;
  secretType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line?: number;
  message?: string;
}

export interface SnytchResult {
  findings: SnytchFinding[];
  totalFindings: number;
  routeFindings: Map<string, SnytchFinding[]>;
}

export async function loadSnytchResults(projectDir: string): Promise<SnytchResult | null> {
  const possiblePaths = [
    join(projectDir, '.snytch', 'scan-results.json'),
    join(projectDir, 'snytch-report.json'),
  ];

  let rawData: string | null = null;
  for (const filePath of possiblePaths) {
    try {
      rawData = await readFile(filePath, 'utf-8');
      break;
    } catch {
      continue;
    }
  }

  if (!rawData) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawData) as any;
    if (!Array.isArray(parsed.findings)) {
      return null;
    }

    const findings: SnytchFinding[] = parsed.findings.map((item: any) => ({
      filePath: item.file || item.filePath || '',
      secretType: item.type || 'unknown',
      severity: item.severity || 'medium',
      line: item.line,
      message: item.message,
    }));

    const routeFindings = new Map<string, SnytchFinding[]>();
    for (const finding of findings) {
      if (!routeFindings.has(finding.filePath)) {
        routeFindings.set(finding.filePath, []);
      }
      routeFindings.get(finding.filePath)!.push(finding);
    }

    return {
      findings,
      totalFindings: findings.length,
      routeFindings,
    };
  } catch {
    return null;
  }
}
