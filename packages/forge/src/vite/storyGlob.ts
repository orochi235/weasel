import { matchesGlob } from 'node:path';

/**
 * The first of the `stories` globs that names `path`, a posix path relative to the vite root. A glob may be written
 * with a leading `./`, as Storybook's are; `matchesGlob` matches nothing against one.
 */
export function storyGlobOf(path: string, stories: readonly string[]): string | undefined {
  return stories.find((pattern) => matchesGlob(path, pattern.replace(/^\.\//, '')));
}
