import { dirname, matchesGlob, relative, resolve, sep } from 'node:path';

// A port of Storybook 10.4.0's auto-title (preview-api `userOrAutoTitle`, common `normalizeStoriesEntry`)
// for string `stories` entries, which carry no title prefix. It must agree with Storybook or ids and links diverge.

const posix = (path: string): string => path.split(sep).join('/');

/** Storybook's `normalizeStoryPath`. */
const dotted = (path: string): string => (/^\.{1,2}([/\\]|$)/.test(path) ? path : `./${path}`);

/** The directory a stories glob searches from: picomatch `scan`'s `prefix + base`, or a file's directory. */
export function globDirectory(pattern: string): string {
  const segments = pattern.split('/');
  const magic = segments.findIndex((segment) => /^!|(^|[^\\])[*?[{(]/.test(segment));
  return magic === -1 ? dirname(pattern) : segments.slice(0, magic).join('/');
}

/** Storybook's `sanitize` in autoTitle: strips the extension, then collapses `Button/Button`, `index` and `stories.js`. */
function titleParts(parts: string[]): string[] {
  const last = parts[parts.length - 1];
  if (last === undefined) return parts;
  const stripped = last.replace(/(?:[.](?:story|stories))?([.][^.]+)$/i, '');
  if (parts.length === 1) return [stripped];
  const nextToLast = parts[parts.length - 2];
  if (stripped && nextToLast && stripped.toLowerCase() === nextToLast.toLowerCase()) return [...parts.slice(0, -2), stripped];
  if (stripped && (/^(story|stories)([.][^.]+)$/i.test(last) || /^index$/i.test(stripped))) return parts.slice(0, -1);
  return [...parts.slice(0, -1), stripped];
}

const titleFrom = (importPath: string, directory: string): string =>
  titleParts(importPath.replace(directory, '').split('/').filter(Boolean)).join('/');

/**
 * The title Storybook gives a story file whose meta names none: its path under the directory of the first
 * `stories` glob that matches it. A file no glob matches is titled from its path under `root`.
 */
export function autoTitle(file: string, root: string, stories: readonly string[]): string {
  const path = posix(relative(root, file));
  const importPath = dotted(path);
  for (const pattern of stories) {
    if (!matchesGlob(path, pattern.replace(/^\.\//, ''))) continue;
    const directory = dotted(posix(relative(root, resolve(root, globDirectory(pattern))))).replace(/\/$/, '');
    return titleFrom(importPath, directory);
  }
  return titleFrom(importPath, '.');
}
