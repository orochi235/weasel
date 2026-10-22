/**
 * An exported `<text>` drawn by Chromium against weasel's own layout of the
 * same node: every glyph has to start where the layout puts its cell. The
 * face is the same Inter on both sides — the atlas for weasel, the TTF for the
 * browser — and the two agree on advances and kerning (`assets/fonts/inter`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { bidi } from '@weasel-js/bidi';
import { layoutTextPose, registerBidi, type TextStyle } from '@weasel-js/core';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';
import metricsUrl from '../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../assets/fonts/inter/inter.ttf?url';

const FAMILY = 'SvgExportInter';
const SIZE = 24;
/** The share of a glyph's extent box above its baseline: Inter's `hhea` ascent over ascent plus descent. */
const ASCENT_SHARE = 1984 / (1984 + 494);
/** Chromium rounds the ascent to a whole pixel, so an extent box can sit up to half one off. */
const TOLERANCE = 0.5;

interface Glyph { ch: string; x: number; baseline: number }

const node = (text: string, style: TextStyle, extra: Partial<SvgTextNode> = {}): SvgTextNode => ({
  kind: 'text', x: 20, y: 20, width: 220, height: 160, text, ...extra,
  style: { fontFamily: FAMILY, fontSize: SIZE, lineHeight: 1.4, ...style },
});

/** Every inked glyph of `n` as the layout places it, in source order. */
function laidGlyphs(n: SvgTextNode): Glyph[] {
  const layout = layoutTextPose(n);
  return layout.laid.lines
    .flatMap((line) => line.cells.map((cell) => ({
      src: cell.srcIndex, ch: n.text[cell.srcIndex], x: layout.x + cell.x, baseline: layout.y + line.baselineY,
    })))
    .filter((g) => !/\s/.test(g.ch))
    .sort((a, b) => a.src - b.src)
    .map(({ ch, x, baseline }) => ({ ch, x, baseline }));
}

let host: HTMLDivElement;
/**
 * Whether this Chromium lays glyphs out at whole-pixel advances. Linux headless
 * Chromium has no subpixel positioning, so its glyphs land up to a pixel from any
 * fractional layout and the half-pixel check below cannot be made there.
 */
let snapsAdvances = false;
const SNAPPED = 'this Chromium lays glyphs out at whole-pixel advances, so it cannot place one at a fractional x';

function probeSnapping(): boolean {
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><text x="0" y="30" font-family="${FAMILY}" font-size="${SIZE}">iiiiiiii</text></svg>`;
  const text = host.querySelector('text')!;
  const xs = Array.from({ length: text.getNumberOfChars() }, (_, i) => text.getExtentOfChar(i).x);
  return xs.every((x) => Number.isInteger(x));
}

/** Every inked glyph of the exported `<text>` as Chromium draws it, in source order. */
function drawnGlyphs(svg: string): Glyph[] {
  host.innerHTML = svg;
  const text = host.querySelector('text')!;
  const source = text.textContent ?? '';
  const out: Glyph[] = [];
  for (let i = 0; i < text.getNumberOfChars(); i++) {
    if (/\s/.test(source[i])) continue;
    const box = text.getExtentOfChar(i);
    out.push({ ch: source[i], x: box.x, baseline: box.y + box.height * ASCENT_SHARE });
  }
  return out;
}

const VIEW = { viewBox: { x: 0, y: 0, width: 400, height: 400 } };
let unregisterBidi: () => void;

beforeAll(async () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  const face = new FontFace(FAMILY, `url(${ttfUrl})`);
  document.fonts.add(await face.load());
  await registerFont(FAMILY, {}, metricsUrl, atlasUrl);
  unregisterBidi = registerBidi(bidi);
  snapsAdvances = probeSnapping();
});

afterAll(() => {
  unregisterBidi();
  host.remove();
});

function expectSameGlyphs(drawn: Glyph[], laid: Glyph[]): void {
  expect(drawn.map((g) => g.ch).join('')).toBe(laid.map((g) => g.ch).join(''));
  drawn.forEach((g, i) => {
    expect(Math.abs(g.x - laid[i].x), `${g.ch} #${i} x`).toBeLessThan(TOLERANCE);
    expect(Math.abs(g.baseline - laid[i].baseline), `${g.ch} #${i} baseline`).toBeLessThan(TOLERANCE);
  });
}

describe('an SVG text export written from the layout', () => {
  // Neutrals at a line's end take the paragraph's direction, so an rtl
  // paragraph of Latin text still reorders: `CD!` draws as `!CD`.
  const CASES: Array<[string, SvgTextNode]> = [
    ['a wrapped node', node('Wave, Tofu. AVATAR fig AB CD', { wrap: true })],
    ['a justified node', node('Wave, Tofu. AVATAR fig AB CD ok', { wrap: true, align: 'justify' })],
    ['a centered node', node('Center me\nok', { align: 'center' })],
    ['a line holding a larger run', node('AB\nAB', {}, { runs: [{ text: 'AB\nA' }, { text: 'B', fontSize: 48 }] })],
    ['a wrapped rtl node', node('Hello, world. AB CD! ok?', { direction: 'rtl', wrap: true })],
    ['a centered rtl node', node('one, two!\nthree...', { direction: 'rtl', align: 'center' })],
    ['an rtl node aligned left', node('Amen. (yes)\nWAVE!', { direction: 'rtl', align: 'left' })],
  ];

  for (const [name, n] of CASES) {
    it(`draws every glyph of ${name} where weasel lays it out`, (ctx) => {
      ctx.skip(snapsAdvances, SNAPPED);
      const drawn = drawnGlyphs(serializeSvg([n], { ...VIEW, textLayout: layoutTextPose }));
      expectSameGlyphs(drawn, laidGlyphs(n));
    });
  }
});

describe('an SVG text export written without a layout', () => {
  const CASES: Array<[string, SvgTextNode]> = [
    ['left-aligned lines', node('AVATAR fig\nWave, Tofu.\n\nend', {})],
    ['centered lines', node('Center me\nok\nWAVY Toad', { align: 'center' })],
    ['rtl lines', node('Hello, world!\nAB CD?\n(paren)', { direction: 'rtl' })],
    ['right-aligned lines at line height 1', node('Right\nAligned!', { align: 'right', lineHeight: 1 })],
  ];

  // `dominant-baseline="text-before-edge"` sets the ascent on the box top,
  // where weasel's layout first puts half the leading, so every line here sits
  // that far from its laid-out baseline. What is checked is that each glyph
  // lands at its x and that the lines keep the layout's pitch.
  for (const [name, n] of CASES) {
    it(`draws the glyphs of ${name} at the layout's x, its lines at its pitch`, (ctx) => {
      ctx.skip(snapsAdvances, SNAPPED);
      const drawn = drawnGlyphs(serializeSvg([n], VIEW));
      const laid = laidGlyphs(n);
      const shift = drawn[0].baseline - laid[0].baseline;
      expectSameGlyphs(drawn.map((g) => ({ ...g, baseline: g.baseline - shift })), laid);
    });
  }
});
