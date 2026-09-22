/** Writes every stanced surface's fallback chains into its stylesheet. A test fails when they are stale. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withStanceCss } from '../src/components/stanceCss';
import { STANCE_SURFACES } from '../src/components/stanceSurfaces';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const surface of STANCE_SURFACES) {
  const file = resolve(root, surface.file);
  writeFileSync(file, withStanceCss(readFileSync(file, 'utf8'), surface));
  console.log(`stance rules: ${surface.id} → ${surface.file}`);
}
