/**
 * Which library a story file belongs to, by the package it lives in rather
 * than by its title's first segment. The title prefix is authored per story
 * and disagrees with itself — `packages/ui` alone declares both `Primitives/`
 * and `ui/` — so the path is the answer that cannot drift.
 */
const LIBRARIES: readonly (readonly [marker: string, label: string])[] = [
  ['/packages/ui/', 'ui'],
  ['/packages/labkit/', 'labkit'],
  ['/packages/forge/', 'forge'],
  ['/apps/draw/', 'draw'],
  ['/apps/forge/', 'forge'],
];

/** `entry`'s library, falling back to its title's first segment for a file
 *  under none of the known packages. */
export function libraryOf(entry: { file: string; title: string }): string {
  const file = entry.file.replaceAll('\\', '/');
  for (const [marker, label] of LIBRARIES) {
    if (file.includes(marker)) return label;
  }
  return entry.title.split('/')[0] ?? entry.title;
}
