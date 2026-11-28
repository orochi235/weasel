import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';

/** A package's name and the directory holding its manifest. */
export interface PackageRoot {
  name: string;
  dir: string;
}

/** Whether `dir` is `top` or a directory under it, compared by path segments. */
const within = (dir: string, top: string): boolean => {
  const rel = relative(top, dir);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !/^\.\.[\\/]/.test(rel));
};

/** The nearest `package.json` with a name that holds `file`, at or under `top`. */
export function packageRootOf(file: string, top: string = parse(resolve(file)).root): PackageRoot | null {
  const bound = resolve(top);
  for (let dir = dirname(resolve(file)); within(dir, bound); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const name = (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name;
        if (typeof name === 'string') return { name, dir };
      } catch {
        // An unreadable manifest names no package; the next one up may.
      }
    }
    if (dir === dirname(dir)) break;
  }
  return null;
}

/** The name of the package `file` belongs to: the nearest `package.json` with a name, at or under `top`. */
export function packageNameOf(file: string, top?: string): string | null {
  return packageRootOf(file, top)?.name ?? null;
}
