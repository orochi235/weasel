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
 * face set by a browser.
 *
 * The font's ascent and descent, underline, strikeout, and script metrics go
 * in a top-level `faceMetrics` block, which BMFont has no slot for.
 */
import generateBMFont from 'msdf-bmfont-xml';
import * as opentype from 'opentype.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { gposPairKerning } from '../src/outline/gposKerning.ts';
import { faceMetricsFromTables, type FaceMetricTables } from '../src/faceMetrics.ts';
import { cli } from '../../../scripts/lib/help.mjs';

const { values, positionals } = cli(import.meta.url, {
  summary: 'Bakes an MSDF font atlas for `registerFont`: <out>/<name>.json (BMFont metrics, advances and kerning from the font itself) and <out>/<name>.png.',
  positionals: '<font.ttf|otf>',
  options: {
    name: { type: 'string', placeholder: '<Family-Weight>', description: 'the atlas name, for both files (required)' },
    out: { type: 'string', placeholder: '<dir>', description: 'the directory to write into (required)' },
    size: { type: 'string', placeholder: '<px>', default: '42', description: 'the bake size' },
    charset: { type: 'string', placeholder: 'ascii|latin1', default: 'latin1', description: 'ascii is 0x20–0x7E; latin1 adds 0xA0–0xFF' },
  },
});
if (values.name === undefined || values.out === undefined) {
  console.error('gen-font: needs --name and --out');
  console.error('usage: npm run gen:font -- <font.ttf|otf> --name <Family-Weight> --out <dir> [--size 42] [--charset latin1]');
  process.exit(2);
}

function charset(kind: string): string {
  const range = (a: number, b: number) =>
    Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i)).join('');
  const ascii = range(0x20, 0x7e);
  if (kind === 'ascii') return ascii;
  if (kind === 'latin1') return ascii + range(0xa0, 0xff);
  throw new Error(`unknown charset: ${kind}`);
}

const fontPath = positionals[0];
const name = values.name as string;
const outDir = values.out as string;
const fontSize = Number(values.size);

interface BakedChar { id: number; xadvance: number }
interface Baked {
  info: { face: string; size: number }; chars: BakedChar[]; kernings: unknown[]; faceMetrics?: unknown;
}

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
  // Unrounded: an em fraction the outline tier recomputes at runtime must
  // come out bit-identical, or the two tiers place rules differently.
  const { hhea, post, os2 } = font.tables as Pick<FaceMetricTables, 'hhea' | 'post' | 'os2'>;
  const faceMetrics = faceMetricsFromTables({ unitsPerEm: font.unitsPerEm, hhea, post, os2 });
  if (faceMetrics) data.faceMetrics = faceMetrics;
}

generateBMFont(
  fontPath,
  {
    outputType: 'json',
    fieldType: 'msdf',
    fontSize,
    distanceRange: 4,
    charset: charset(values.charset as string),
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
