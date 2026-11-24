import { matchesGlob } from 'node:path';
import { posixRelative } from './posixPath.ts';

/**
 * The first of the `stories` globs that names `path`, a posix path relative to the vite root. A glob may be written
 * with a leading `./`, as Storybook's are; `matchesGlob` matches nothing against one.
 */
export function storyGlobOf(path: string, stories: readonly string[]): string | undefined {
  return stories.find((pattern) => matchesGlob(path, pattern.replace(/^\.\//, '')));
}

/** Whether `file`, an absolute path, is a story file: one the `stories` globs name, relative to `root`, outside `node_modules`. */
export function isStoryFile(root: string, file: string, stories: readonly string[]): boolean {
  const path = posixRelative(root, file);
  return !path.split('/').includes('node_modules') && storyGlobOf(path, stories) !== undefined;
}
