import { relative, sep } from 'node:path';

/** `path` written with `/` between its segments, whatever separator the platform writes. */
export const posix = (path: string, separator: string = sep): string => path.split(separator).join('/');

/** `file`'s path relative to `root`, written with `/`. */
export const posixRelative = (root: string, file: string): string => posix(relative(root, file));
