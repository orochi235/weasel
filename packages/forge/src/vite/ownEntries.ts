import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Entry modules of forge's own realms: source beside this file in a checkout, the built entries in an install. */
export function ownEntries(realms: readonly string[]): string[] {
  const here = fileURLToPath(import.meta.url);
  for (let dir = dirname(here); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (!existsSync(manifest) || (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }).name !== '@weasel-js/forge') {
      continue;
    }
    const source = !relative(join(dir, 'src'), here).startsWith('..');
    return realms.map((realm) => join(dir, source ? `src/${realm}/index.ts` : `dist/${realm}/index.js`));
  }
  return [];
}
