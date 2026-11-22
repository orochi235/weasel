// Every story of ui and labkit, by path from this directory; nothing is imported until a test asks for it.
export const STORY_MODULES = import.meta.glob([
  '../../packages/ui/src/**/*.stories.{ts,tsx}',
  '../../packages/labkit/src/**/*.stories.{ts,tsx}',
]);

/** `../../packages/ui/src/x.stories.tsx` → `ui/src/x.stories.tsx`: how `a11y.known.ts` names a story file. */
export const storyKey = (path: string): string => path.replace(/^\.\.\/\.\.\/packages\//, '');

/** Each key of `tables` naming no file in `files`, as `<table>: <key>`: an entry whose story was moved or deleted. */
export function unresolvedKeys(tables: Readonly<Record<string, object>>, files: readonly string[]): string[] {
  const known = new Set(files.map(storyKey));
  return Object.entries(tables).flatMap(([table, entries]) =>
    Object.keys(entries).filter((key) => !known.has(key)).map((key) => `${table}: ${key}`),
  );
}
