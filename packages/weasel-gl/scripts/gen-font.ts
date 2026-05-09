#!/usr/bin/env tsx
/**
 * gen-font — wraps msdf-bmfont-xml to produce a JSON metrics file + PNG atlas
 * for use in packages/weasel-gl/fonts/<family>/.
 *
 * Usage:
 *   npm run gen:font -- --font path/to/Inter.ttf --out packages/weasel-gl/fonts/inter --size 32
 *
 * Output:
 *   <out>/<stem>.json   — BmFont metrics JSON
 *   <out>/<stem>.png    — MSDF atlas PNG (RGBA, 512×512 by default)
 *
 * The prebuilt Inter atlas is committed to the repo under
 * packages/weasel-gl/fonts/inter/. Re-run only when updating the font or
 * adding new charset coverage.
 *
 * Charset: ASCII + Latin-1 (U+0020–U+00FF, 224 codepoints). msdf-bmfont-xml
 * v2.8 doesn't accept a numeric charset range on the CLI; we write a temp
 * charset file containing the literal codepoints and pass --charset-file.
 *
 * CJK / complex script shaping: deferred. See the WebGL transition spec.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, basename, extname, join } from 'node:path';

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const fontPath = flag('font');
const outDir = flag('out');
const size = Number(flag('size') ?? 32);
const atlasSize = Number(flag('atlas') ?? 512);
const startCp = Number(flag('charset-start') ?? 0x20);
const endCp = Number(flag('charset-end') ?? 0xff);

if (!fontPath || !outDir) {
  console.error('Usage: npm run gen:font -- --font <path> --out <dir> [--size 32] [--atlas 512]');
  console.error('  Optional: --charset-start <codepoint> --charset-end <codepoint>');
  process.exit(1);
}

const absOut = resolve(process.cwd(), outDir);
mkdirSync(absOut, { recursive: true });

const stem = basename(fontPath, extname(fontPath)).toLowerCase();
const outJson = resolve(absOut, `${stem}.json`);

// Build a charset file with codepoints in [startCp, endCp]. Skip chars that
// can't be safely written into a UTF-8 file (e.g. surrogates, line breaks if
// they collide with msdf-bmfont's parser). For ASCII + Latin-1 there are no
// such hazards.
const tmpDir = mkdtempSync(join(tmpdir(), 'weasel-gl-charset-'));
const charsetFile = join(tmpDir, 'charset.txt');
const codepoints: string[] = [];
for (let cp = startCp; cp <= endCp; cp++) {
  // Skip control chars 0x7F-0x9F to keep the output readable; msdf-bmfont
  // treats them as glyph requests but they're rarely useful and some TTFs
  // omit them.
  if (cp >= 0x7f && cp <= 0x9f) continue;
  codepoints.push(String.fromCodePoint(cp));
}
writeFileSync(charsetFile, codepoints.join(''));

execFileSync(
  'npx',
  [
    'msdf-bmfont',
    '-f', 'json',
    '-o', outJson,
    '-m', `${atlasSize},${atlasSize}`,
    '-s', String(size),
    '-t', 'msdf',
    '-i', charsetFile,
    fontPath,
  ],
  { stdio: 'inherit' },
);

console.log(`✓ atlas + metrics → ${absOut}`);
