import { loadFontOutlines, registerFont, registerFontOutlines, type ResolveResult } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import type { TextDrawCommand } from '@weasel-js/renderer';
import {
  layoutRuns,
  type ResolvedRun,
  SYNTHETIC_ITALIC_RADIANS,
  syntheticBoldOffset,
  verticalAlignOffset,
} from '@weasel-js/text';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { num } from './num';
import { type PdfFontSource, registryFontSource } from './fonts/fontSource';
import { latin1 } from './testing/latin1';
import { writePdf } from './writePdf';

const INTER = resolve(import.meta.dirname, '../../../assets/fonts/inter');
const SIZE = 20;

function interBytes(): ArrayBuffer {
  const buf = readFileSync(`${INTER}/inter.ttf`);
  // Built in this test's realm: the registry's `instanceof ArrayBuffer` rejects Node's.
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

async function registerOutlines(family: string): Promise<void> {
  registerFontOutlines(family, {}, interBytes());
  await loadFontOutlines(family, {});
}

/** Inter's real atlas at 400 only, so 700 is faked from it, with its outlines behind it. */
async function registerAtlas(family: string): Promise<void> {
  const metrics = JSON.parse(readFileSync(`${INTER}/inter.json`, 'utf8'));
  global.fetch = vi.fn().mockImplementation((url: string) =>
    url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(metrics) })
      : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) }),
  ) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 256, close: vi.fn() } as unknown as ImageBitmap);
  await registerFont(family, { weight: 400 }, `/${family}.json`, `/${family}.png`);
  registerFontOutlines(family, { weight: 400 }, interBytes());
  await loadFontOutlines(family, { weight: 400 });
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  await registerOutlines('sans-serif');
});
afterEach(() => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

function run(text: string, over: Partial<ResolvedRun> = {}): ResolvedRun {
  return {
    text,
    fontFamily: 'sans-serif',
    fontSize: SIZE,
    fontWeight: 400,
    fontStyle: 'normal',
    fill: { paint: { color: '#336699' } },
    letterSpacing: 0,
    underline: false,
    strikethrough: false,
    overline: false,
    baselineShift: 0,
    ...over,
  };
}

function textCmd(runs: ResolvedRun[], over: Partial<TextDrawCommand> = {}): TextDrawCommand {
  return { kind: 'text', x: 10, y: 30, runs, style: { fontFamily: 'sans-serif', fontSize: SIZE }, ...over };
}

async function render(cmd: TextDrawCommand, fonts: PdfFontSource = registryFontSource) {
  const { bytes, skipped } = await writePdf([{ width: 300, height: 200, commands: [cmd] }], { fonts, compress: false });
  const s = latin1(bytes);
  const content = s.slice(s.indexOf('stream\n') + 7, s.indexOf('\nendstream'));
  return { s, content, skipped };
}

/** The operand of each `TJ`, as its hex strings and numbers in order. */
function tjOf(content: string): (string | number)[][] {
  return [...content.matchAll(/^\[(.*)\] TJ$/gm)].map((m) =>
    [...m[1].matchAll(/<([0-9A-F]+)>|(-?[\d.]+)/g)].map((t) => (t[1] !== undefined ? t[1] : Number(t[2]))),
  );
}

async function gidHex(cp: number, family = 'sans-serif', weight = 400): Promise<string> {
  const e = (await registryFontSource.embedding(family, weight, 'normal'))!;
  return e.glyphIndexOf(cp)!.toString(16).toUpperCase().padStart(4, '0');
}

/** The TJ adjustment between the first and second glyph, 0 when none is written. */
function adjustmentAfterFirst(tj: (string | number)[]): number {
  const first = tj[0] as string;
  if (first.length > 4) return 0;
  return typeof tj[1] === 'number' ? tj[1] : 0;
}

const layoutOpts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const, direction: 'ltr' as const };

describe('writeText', () => {
  it('lays text out with the options drawText uses and writes it as TJ in the embedded font', async () => {
    const runs = [run('Hi')];
    const { s, content, skipped } = await render(textCmd(runs));
    const laid = layoutRuns(runs, layoutOpts);
    const [h, i] = laid.lines[0].glyphs;
    expect(skipped).toEqual([]);
    const bt = content.slice(content.indexOf('BT\n'), content.indexOf('\nET') + 3).split('\n');
    expect(bt[0]).toBe('BT');
    expect(bt[1]).toBe('/F1 1 Tf');
    expect(bt[2]).toBe(`${SIZE} 0 0 -${SIZE} ${num(10 + h.x)} ${num(30 + h.baselineY)} Tm`);
    expect(bt.at(-1)).toBe('ET');
    const tj = tjOf(content)[0].filter((t) => typeof t === 'string').join('');
    expect(tj).toBe((await gidHex(0x48)) + (await gidHex(0x69)));
    expect(i.x).toBeGreaterThan(h.x);
    expect(content).toContain(`${num(0x33 / 255)} ${num(0x66 / 255)} ${num(0x99 / 255)} rg`);
    expect(s).toMatch(/\/Font <<\/F1 \d+ 0 R>>/);
    expect(s).toContain('/Subtype /Type0');
  });

  it('corrects each glyph to the layout step with TJ adjustments', async () => {
    const base = adjustmentAfterFirst(tjOf((await render(textCmd([run('Hi')]))).content)[0]);
    _resetLayoutCacheForTests();
    const spaced = adjustmentAfterFirst(tjOf((await render(textCmd([run('Hi', { letterSpacing: 5 })]))).content)[0]);
    expect(spaced - base).toBeCloseTo(-5000 / SIZE, 3);
  });

  it('shifts by verticalAlign as drawText does', async () => {
    const runs = [run('Hi')];
    const { content } = await render(textCmd(runs, { height: 100, verticalAlign: 'center' }));
    const laid = layoutRuns(runs, layoutOpts);
    const y = 30 + verticalAlignOffset('center', 100, laid.bounds.height) + laid.lines[0].baselineY;
    expect(verticalAlignOffset('center', 100, laid.bounds.height)).toBeGreaterThan(0);
    expect(content).toMatch(new RegExp(` ${num(y)} Tm\n`));
  });

  it('draws a glyph the face cannot embed as its outline', async () => {
    const { s, content, skipped } = await render(textCmd([run('H')]), { ...registryFontSource, embedding: async () => null });
    expect(skipped).toEqual([]);
    expect(content).not.toContain('BT');
    expect(content).toMatch(/ l\n/);
    expect(content).toMatch(/\nf\n/);
    expect(s).not.toContain('/Font');
  });

  it('leaves out and reports a character no source can draw, keeping the rest as text', async () => {
    const { content, skipped } = await render(textCmd([run('A😀B')]));
    const tj = tjOf(content)[0].filter((t) => typeof t === 'string').join('');
    expect(tj).toBe((await gidHex(0x41)) + (await gidHex(0x42)));
    expect(skipped).toHaveLength(1);
    expect(skipped[0].kind).toBe('glyph');
    expect(skipped[0].detail).toContain('U+1F600');
    expect(content).not.toContain('<0000>');
  });

  it('strokes a run with a stroke using text render mode 2 or 1', async () => {
    const stroke = { paint: { color: '#ff0000' }, width: 2 };
    const both = (await render(textCmd([run('H', { stroke })]))).content;
    expect(both).toContain('\n2 Tr\n');
    expect(both).toContain('1 0 0 RG');
    expect(both).toContain('\n2 w\n');
    _resetLayoutCacheForTests();
    const only = (await render(textCmd([run('H', { stroke, fill: null })]))).content;
    expect(only).toContain('\n1 Tr\n');
    expect(only).not.toMatch(/ rg\n/);
  });

  it('fakes bold with render mode 2 at the offset syntheticBoldOffset gives, and italic with a skewed Tm', async () => {
    await registerAtlas('faux');
    const style = { fontFamily: 'faux', fontSize: SIZE };
    const bold = (await render(textCmd([run('H', { fontFamily: 'faux', fontWeight: 700 })], { style }))).content;
    const resolved: ResolveResult = {
      entry: null,
      source: 'atlas',
      resolved: { family: 'faux', weight: 400, style: 'normal' },
      synthetic: { bold: true, italic: false },
    };
    const offset = syntheticBoldOffset(resolved)!;
    expect(offset.growth).toBeGreaterThan(0);
    expect(bold).toContain('\n2 Tr\n');
    // The growth is per side and a stroke straddles the edge, so it is twice as wide.
    expect(bold).toContain(`\n${num(2 * offset.growth * SIZE)} w\n`);
    expect(bold).toContain('\n0 j\n');

    _resetLayoutCacheForTests();
    const italic = (await render(textCmd([run('H', { fontStyle: 'italic' })]))).content;
    // Above the baseline (glyph y up, local y down) a glyph leans toward +x, as the renderer shears it.
    const c = num(SIZE * Math.tan(SYNTHETIC_ITALIC_RADIANS));
    expect(italic).toMatch(new RegExp(`\n${SIZE} 0 ${c} -${SIZE} [\\d.]+ [\\d.]+ Tm\n`));
    expect(Number(c)).toBeGreaterThan(0);
  });

  it('draws underline and strikethrough as filled rules', async () => {
    const { content } = await render(textCmd([run('Hi', { underline: true, strikethrough: true })]));
    const after = content.slice(content.indexOf('\nET\n'));
    expect([...after.matchAll(/ re\nf\n/g)]).toHaveLength(2);
    expect(after).toContain(`${num(0x33 / 255)} ${num(0x66 / 255)} ${num(0x99 / 255)} rg`);
  });

  it('clips to the glyphs and shades them for a gradient fill', async () => {
    const paint = {
      kind: 'linear-gradient' as const,
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      stops: [
        { offset: 0, color: '#ff0000' },
        { offset: 1, color: '#0000ff' },
      ],
    };
    const { s, content } = await render(textCmd([run('Hi', { fill: { paint } })]));
    const tr = content.indexOf('\n7 Tr\n');
    const et = content.indexOf('\nET\n');
    const sh = content.indexOf(' sh\n');
    expect(tr).toBeGreaterThan(0);
    expect(et).toBeGreaterThan(tr);
    expect(sh).toBeGreaterThan(et);
    expect(content.slice(0, tr)).toMatch(/\nq\n/);
    expect(content.slice(sh)).toMatch(/\nQ\n/);
    expect(s).toContain('/ShadingType 2');
  });
});
