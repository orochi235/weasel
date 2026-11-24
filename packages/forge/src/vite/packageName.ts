import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/** The name of the package `file` belongs to: the nearest `package.json` with a name, at or under `top`. */
export function packageNameOf(file: string, top: string = parse(file).root): string | null {
  for (let dir = dirname(file); dir.startsWith(top); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const name = (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name;
        if (typeof name === 'string') return name;
      } catch {
        // An unreadable manifest names no package; the next one up may.
      }
    }
    if (dir === top || dir === dirname(dir)) break;
  }
  return null;
}
