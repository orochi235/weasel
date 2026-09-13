import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { measureTextBounds, textLineBoxes, type TextStyle } from '@weasel-js/core';
import { parseSvg, serializeSvg } from './index';
import type { SvgTextNode } from './types';

const VIEW = { viewBox: { x: 0, y: 0, width: 400, height: 200 } };

function textNode(style: TextStyle): SvgTextNode {
  return { kind: 'text', x: 10.5, y: 3, width: 77.25, height: 20, text: 'AB', style };
}

function attr(svg: string, name: string): string | null {
  return new RegExp(`<text[^>]* ${name}="([^"]*)"`).exec(svg)?.[1] ?? null;
}

function onlyText(svg: string): SvgTextNode {
  const n = parseSvg(svg).nodes[0];
  if (n?.kind !== 'text') throw new Error('expected text');
  return n;
}

const CASES: ReadonlyArray<{ style: TextStyle; anchor: string | null; x: number }> = [
  { style: { align: 'left' }, anchor: null, x: 10.5 },
  { style: { align: 'center' }, anchor: 'middle', x: 49.125 },
  { style: { align: 'right' }, anchor: 'end', x: 87.75 },
  { style: { align: 'start', direction: 'rtl' }, anchor: null, x: 87.75 },
  { style: { align: 'center', direction: 'rtl' }, anchor: 'middle', x: 49.125 },
  { style: { align: 'end', direction: 'rtl' }, anchor: 'end', x: 10.5 },
  { style: { align: 'left', direction: 'rtl' }, anchor: 'end', x: 10.5 },
  { style: { direction: 'rtl' }, anchor: 'end', x: 10.5 },
];

describe('text-anchor point', () => {
  for (const { style, anchor, x } of CASES) {
    const label = `${style.align ?? '(unset)'} ${style.direction ?? 'ltr'}`;

    it(`writes x as the anchor point: ${label}`, () => {
      const out = serializeSvg([textNode(style)], VIEW);
      expect(attr(out, 'text-anchor')).toBe(anchor);
      expect(Number(attr(out, 'x'))).toBe(x);
    });

    it(`reads a weasel-written box back exactly: ${label}`, () => {
      const node = textNode(style);
      const back = onlyText(serializeSvg([node], VIEW));
      expect([back.x, back.y, back.width, back.height])
        .toEqual([node.x, node.y, node.width, node.height]);
    });
  }
});

describe('external <text> without data-weasel-*', () => {
  const realFetch = global.fetch;
  const realBitmap = global.createImageBitmap;

  beforeEach(() => {
    _resetFontRegistryForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
      : Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      })) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
  });

  afterEach(() => {
    _resetFontRegistryForTests();
    global.fetch = realFetch;
    global.createImageBitmap = realBitmap;
  });

  const register = () => registerFont('inter', {}, '/f/inter.json', '/f/inter.png');
  const external = (attrs: string, body = 'AB') => `<svg xmlns="http://www.w3.org/2000/svg">
    <text x="200" y="50" font-family="inter" font-size="32" ${attrs}>${body}</text></svg>`;

  /** Where kit:text paints the node's first line, per the painter's own layout. */
  function paintedLine(n: SvgTextNode): { left: number; right: number } {
    const [box] = textLineBoxes(
      { x: n.x, y: n.y, width: n.width, height: n.height, text: n.text, runs: n.runs, style: n.style },
      { maxWidth: Infinity },
    );
    return { left: box.x, right: box.x + box.width };
  }

  it('measures the width with the registered font', async () => {
    await register();
    const n = onlyText(external(''));
    const measured = measureTextBounds('AB', { fontFamily: 'inter', fontSize: 32 }).width;
    expect(measured).toBeGreaterThan(0);
    expect(n.width).toBeCloseTo(measured, 6);
  });

  it('paints start-anchored text from the anchor', async () => {
    await register();
    expect(paintedLine(onlyText(external(''))).left).toBeCloseTo(200, 6);
  });

  it('paints middle-anchored text centered on the anchor', async () => {
    await register();
    const line = paintedLine(onlyText(external('text-anchor="middle"')));
    expect((line.left + line.right) / 2).toBeCloseTo(200, 6);
  });

  it('paints end-anchored text ending at the anchor', async () => {
    await register();
    expect(paintedLine(onlyText(external('text-anchor="end"'))).right).toBeCloseTo(200, 6);
  });

  it('paints rtl start-anchored text ending at the anchor', async () => {
    await register();
    expect(paintedLine(onlyText(external('direction="rtl"'))).right).toBeCloseTo(200, 6);
  });

  it('measures styled runs, not just the plain string', async () => {
    await register();
    const n = onlyText(external('text-anchor="end"', 'A<tspan font-size="64">B</tspan>'));
    expect(n.width).toBeGreaterThan(measureTextBounds('AB', { fontFamily: 'inter', fontSize: 32 }).width);
    expect(paintedLine(n).right).toBeCloseTo(200, 6);
  });

  it('falls back to a finite estimate when no font can measure it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const n = onlyText(external('text-anchor="middle"'));
      expect(n.width).toBeGreaterThan(0);
      expect(n.width).toBeLessThan(1000);
      expect(n.x + n.width / 2).toBeCloseTo(200, 6);
    } finally {
      warn.mockRestore();
    }
  });
});
