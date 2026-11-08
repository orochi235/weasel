export function matchLines(source: string, pattern: RegExp): number[];
export function sourceFiles(dir: string, options: { skip: Set<string>; keep: (name: string) => boolean }): Generator<string>;
export function offendingLines(lines: number[], allowedUses?: number): number[];
export function judgeUses(
  found: Map<string, number[]>,
  allowed: Map<string, string | [string, number]>,
): { offenders: string[]; stale: string[] };
