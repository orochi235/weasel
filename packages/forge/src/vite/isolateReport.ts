import type { IndexEntry } from '../story/types';

/**
 * What `check:forge-isolate` prints: one line per isolated story, id then reason with the reasons
 * aligned, then the count against `allowed`. `ok` is false when the count is above it.
 */
export function isolateReport(entries: readonly IndexEntry[], allowed: number): { lines: string[]; ok: boolean } {
  const isolated = entries.filter((entry): entry is IndexEntry & { isolate: string } => entry.isolate !== undefined);
  const width = Math.max(0, ...isolated.map((entry) => entry.id.length));
  const lines = isolated.map((entry) => `${entry.id.padEnd(width)}  ${entry.isolate}`);
  const count = isolated.length;
  lines.push(`${count} isolated ${count === 1 ? 'story' : 'stories'} (allowed: ${allowed})`);
  const ok = count <= allowed;
  if (!ok) {
    lines.push(
      `${count} is above the ${allowed} allowed. Render the story in the workshop document, or raise ALLOWED in packages/forge/scripts/check-isolate.ts in the same change.`,
    );
  }
  return { lines, ok };
}
