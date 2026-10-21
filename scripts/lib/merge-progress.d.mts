export function mergeProgress(
  children: number,
  expected?: number,
): { line(child: number, text: string): string[]; finish(): string[] };
