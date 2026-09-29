/**
 * Bake an MSDF font atlas for `registerFont`.
 *
 *   npm run gen:font -- <font.ttf|otf> --name <Family-Weight> --out <dir> [--size 42] [--charset latin1]
 *
 * Emits `<out>/<name>.json` (BmFont metrics) + `<out>/<name>.png` (atlas).
 * Charsets: `ascii` (0x20–0x7E), `latin1` (ascii + 0xA0–0xFF, default).
 *
 * Advances and kerning are rewritten from the font itself: msdf-bmfont-xml
 * rounds `xadvance` to whole pixels at the bake size and reads no GPOS
 * extension lookups, so text laid out from its numbers drifts from the same
 * face set by a browser — 2.8px over "Hxgd" at 72px for Inter.
 */
import generateBMFont from 'msdf-bmfont-xml';
import * as opentype from 'opentype.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { gposPairKerning } from '../src/outline/gposKerning.ts';

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

interface BakedChar { id: number; xadvance: number }
interface Baked { info: { face: string; size: number }; chars: BakedChar[]; kernings: unknown[] }

/** Four decimals at the bake size is under 0.001px at 200px. */
const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** Replace the bake's advances and kerning with the font's own, at full precision. */
function exactMetrics(data: Baked, file: string): void {
  const buf = readFileSync(file);
  const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  // Node loads opentype.js's UMD build, whose exports sit under `default`.
  const ot = (opentype as unknown as { default?: typeof opentype }).default ?? opentype;
  const font = ot.parse(bytes);
  const scale = data.info.size / font.unitsPerEm;
  const glyphs = data.chars.map((c) => ({ c, g: font.charToGlyph(String.fromCodePoint(c.id)) }));
  for (const { c, g } of glyphs) c.xadvance = round((g.advanceWidth ?? 0) * scale);
  const gpos = gposPairKerning(bytes);
  const kern = gpos ?? ((l: number, r: number) => font.getKerningValue(l, r));
  const kernings: { first: number; second: number; amount: number }[] = [];
  for (const a of glyphs) {
    for (const b of glyphs) {
      const amount = kern(a.g.index, b.g.index);
      if (amount !== 0) kernings.push({ first: a.c.id, second: b.c.id, amount: round(amount * scale) });
    }
  }
  data.kernings = kernings;
  data.info.face = font.getEnglishName('postScriptName') ?? data.info.face;
}

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
    exactMetrics(data, fontPath);
    writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(data));
    writeFileSync(path.join(outDir, `${name}.png`), textures[0].texture);
    console.log(`baked ${name}: ${data.chars.length} glyphs -> ${outDir}`);
  },
);
