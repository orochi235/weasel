// The repo's story index as the workshop builds it, read from source without starting vite.
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import type { IndexEntry } from '../src/story/types.ts';

export const repoRoot = resolve(import.meta.dirname, '../../..');

// The forge source imports its siblings without extensions, which vite resolves and node's type stripping does not.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || (error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw error;
      for (const extension of ['.ts', '.tsx']) {
        try {
          return next(`${specifier}${extension}`, context);
        } catch {}
      }
      throw error;
    }
  },
});

const { indexStoryResolved } = await import('../src/vite/indexStory.ts');
const { stories } = await import('../../../apps/forge/viteShared.ts');
const { weaselAliases } = await import('../../../scripts/vite-aliases.ts');

// Enough of vite's resolution to follow a story file's `meta` and `story` to forge: relative paths and the repo's aliases.
const aliases = weaselAliases(repoRoot);
const isFile = (path: string) => existsSync(path) && statSync(path).isFile();
const sourceAt = (path: string) =>
  [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts'), join(path, 'index.tsx')].find(isFile) ?? null;
const resolveImport = async (spec: string, importer: string) => {
  if (spec.startsWith('.')) return sourceAt(resolve(dirname(importer), spec));
  for (const { find, replacement } of aliases) {
    if (typeof find === 'string' ? spec === find : find.test(spec)) return sourceAt(spec.replace(find, replacement));
  }
  return null;
};

/** Every story the workshop indexes, in its order. */
export async function repoEntries(): Promise<IndexEntry[]> {
  // A failed story run leaves `__screenshots__/<file>.stories.tsx/` directories that match the globs.
  const files = [...new Set(stories.flatMap((pattern) => globSync(pattern, { cwd: repoRoot })))]
    .filter((path) => statSync(resolve(repoRoot, path)).isFile())
    .sort();
  const entries: IndexEntry[] = [];
  for (const path of files) {
    const file = resolve(repoRoot, path);
    const indexed = await indexStoryResolved(readFileSync(file, 'utf8'), file, { root: repoRoot, stories }, resolveImport);
    entries.push(...indexed.entries);
  }
  return entries;
}
