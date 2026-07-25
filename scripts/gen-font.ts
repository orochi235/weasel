/**
 * Bake an MSDF font atlas for `registerFont`.
 *
 *   npm run gen:font -- <font.ttf|otf> --name <Family-Weight> --out <dir> [--size 42] [--charset latin1]
 *
 * Emits `<out>/<name>.json` (BmFont metrics) + `<out>/<name>.png` (atlas).
 * Charsets: `ascii` (0x20–0x7E), `latin1` (ascii + 0xA0–0xFF, default).
 */
import generateBMFont from 'msdf-bmfont-xml';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

function charset(kind: string): string {
  const range = (a: number, b: number) =>
    Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i)).join('');
  const ascii = range(0x20, 0x7e);
  if (kind === 'ascii') return ascii;
  if (kind === 'latin1') return ascii + range(0xa0, 0xff);
  throw new Error(`unknown charset: ${kind}`);
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

const fontPath = process.argv[2];
if (!fontPath || fontPath.startsWith('--')) throw new Error('usage: gen-font <font.ttf> --name <n> --out <dir>');
const name = arg('name');
const outDir = arg('out');
const fontSize = Number(arg('size', '42'));

generateBMFont(
  fontPath,
  {
    outputType: 'json',
    fieldType: 'msdf',
    fontSize,
    distanceRange: 4,
    charset: charset(arg('charset', 'latin1')),
    smartSize: true,
    pot: true,
  },
  (err: Error | null, textures: { filename: string; texture: Buffer }[], font: { data: string }) => {
    if (err) throw err;
    if (textures.length !== 1) throw new Error(`expected 1 atlas page, got ${textures.length} — raise textureSize`);
    mkdirSync(outDir, { recursive: true });
    // registerFont loads a single atlas image, so rewrite the page ref to our name.
    const data = JSON.parse(font.data);
    data.pages = [`${name}.png`];
    writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(data));
    writeFileSync(path.join(outDir, `${name}.png`), textures[0].texture);
    console.log(`baked ${name}: ${data.chars.length} glyphs -> ${outDir}`);
  },
);
