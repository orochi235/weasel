// Packs a built target into dist/weasel-devtools-<target>.zip, for a store upload or a signed Firefox build.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { TARGETS, type Target } from '../manifest.ts';

const target = process.argv[2] as Target;
if (!TARGETS.includes(target)) {
  console.error(`usage: zip.ts <${TARGETS.join('|')}>`);
  process.exit(1);
}
const dist = resolve(import.meta.dirname, '../dist');
const dir = resolve(dist, target);
if (!existsSync(resolve(dir, 'manifest.json'))) {
  console.error(`devtools-extension: ${dir} is not built; run npm run build:devtools-extension first`);
  process.exit(1);
}
const zip = resolve(dist, `weasel-devtools-${target}.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, '.'], { cwd: dir, stdio: 'inherit' });
console.log(`devtools-extension: ${zip}`);
