import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * A stylesheet's text as the bundler assembles it: each relative `@import`
 * replaced by the sheet it names. For a test that reads rules off disk because
 * jsdom computes nothing; a module assembled from imports holds none itself.
 */
export function readModuleCss(file: string): string {
  return readFileSync(file, 'utf8').replace(/@import '(\.\/[^']+)';\n?/g, (_, rel: string) =>
    readModuleCss(resolve(dirname(file), rel)),
  );
}
