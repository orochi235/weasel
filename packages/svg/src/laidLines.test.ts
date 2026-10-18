import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutTextPose, type TextPoseLayout } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { svgNeeds } from './warm';
import { trimNumber as t } from './transform';
import type { SvgTextNode } from './types';

// FIXTURE_FONT at 32: 'AB' advances 44 and a space 8, so 'AB AB' is 96 and a
// third word wraps in a 100-wide box.

const realFetch = global.fetch;
const realBitmap = global.createImageBitmap;

beforeEach(async () => {
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
  await registerFont('inter', {}, '/f/inter.json', '/f/inter.png');
});

afterEach(() => {
  _resetFontRegistryForTests();
  global.fetch = realFetch;
  global.createImageBitmap = realBitmap;
});

const node = (text: string, extra: Partial<SvgTextNode> = {}): SvgTextNode => ({
  kind: 'text', x: 10, y: 20, width: 100, height: 120, text,
  ...extra,
  style: { fontFamily: 'inter', fontSize: 32, ...extra.style },
});
const VIEW = { viewBox: { x: 0, y: 0, width: 400, height: 400 } };
const laidSvg = (n: SvgTextNode, onWarn?: (m: string) => void): string =>
  serializeSvg([n], { ...VIEW, textLayout: layoutTextPose, ...(onWarn ? { onWarn } : {}) });
const body = (svg: string): string => /<text[^>]*>(.*)<\/text>/s.exec(svg)![1];
const textAttrs = (svg: string): string => /<text([^>]*)>/.exec(svg)![1];
const readBack = (svg: string): SvgTextNode => parseSvg(svg).nodes[0] as SvgTextNode;

/** Where the layout puts line `i`'s first cell, in document units. */
function lineAt(layout: TextPoseLayout, i: number): { x: number; y: number } {
  const line = layout.laid.lines[i];
  return { x: layout.x + Math.min(...line.cells.map((c) => c.x)), y: layout.y + line.baselineY };
}

describe('serializeSvg with a text layout', () => {
  it('writes each wrapped line as a tspan at the layout\'s own position', () => {
    const n = node('AB AB AB', { style: { wrap: true } });
    const layout = layoutTextPose(n);
    expect(layout.laid.lines).toHaveLength(2);
    const [a, b] = [lineAt(layout, 0), lineAt(layout, 1)];
    const warnings: string[] = [];
    const svg = laidSvg(n, (m) => warnings.push(m));
    expect(body(svg)).toBe(
      `<tspan x="${t(a.x)}" y="${t(a.y)}" data-weasel-lines="0">AB AB </tspan>`
      + `<tspan x="${t(b.x)}" y="${t(b.y)}" data-weasel-lines="0">AB</tspan>`,
    );
    // The lines sit on their baselines, so the box-top baseline is not written.
    expect(textAttrs(svg)).not.toContain('dominant-baseline');
    expect(warnings.filter((w) => w.includes('wraps'))).toEqual([]);
  });

  it('reads a wrapped node back as one paragraph that wraps, in the same box', () => {
    const n = node('AB AB AB', { style: { wrap: true, lineHeight: 1.5 } });
    const back = readBack(laidSvg(n));
    expect(back.text).toBe('AB AB AB');
    expect(back.style?.wrap).toBe(true);
    expect(back.style?.lineHeight).toBe(1.5);
    expect([back.x, back.y, back.width, back.height]).toEqual([n.x, n.y, n.width, n.height]);
  });

  it('keeps a hard break inside wrapped text as a break', () => {
    const n = node('AB AB AB\nAB', { style: { wrap: true } });
    const svg = laidSvg(n);
    expect(body(svg)).toMatch(/<tspan x="[\d.]+" y="[\d.]+">AB<\/tspan>$/);
    expect(readBack(svg).text).toBe('AB AB AB\nAB');
  });

  it('places each word of a justified line at its own x', () => {
    const n = node('AB AB AB AB', { width: 100, style: { wrap: true, align: 'justify' } });
    const layout = layoutTextPose(n);
    const first = layout.laid.lines[0];
    const second = first.cells.find((c, i) => i > 0 && c.cp !== 32 && first.cells[i - 1].cp === 32)!;
    const secondX = layout.x + second.x;
    // The slack went into the gap, so the second word is not where 'AB ' ends.
    expect(secondX).toBeGreaterThan(n.x + 52);
    const svg = laidSvg(n);
    expect(body(svg)).toContain(`<tspan x="${t(secondX)}">AB </tspan>`);
    const back = readBack(svg);
    expect(back.text).toBe('AB AB AB AB');
    expect(back.style?.align).toBe('justify');
  });

  it('writes a justified line the layout did not spread as one chunk', () => {
    // Closed by a hard break, then the paragraph's last line: both ragged.
    const n = node('AB AB AB AB\nAB AB', { style: { wrap: true, align: 'justify' } });
    expect(body(laidSvg(n))).toMatch(
      /<\/tspan><tspan x="10" y="[\d.]+" data-weasel-lines="0">AB AB<\/tspan><tspan x="10" y="[\d.]+">AB AB<\/tspan>$/,
    );
  });

  it('pitches a line holding a larger run where the layout puts it', () => {
    const n = node('AB\nAB', {
      runs: [{ text: 'AB\nA' }, { text: 'B', fontSize: 64 }],
      style: { lineHeight: 1.2 },
    });
    const layout = layoutTextPose(n);
    const [a, b] = [lineAt(layout, 0), lineAt(layout, 1)];
    expect(b.y - a.y).not.toBeCloseTo(32 * 1.2, 3);
    const svg = laidSvg(n);
    expect(body(svg)).toBe(
      `<tspan x="${t(a.x)}" y="${t(a.y)}" data-weasel-lines="0">AB</tspan>`
      + `<tspan x="${t(b.x)}" y="${t(b.y)}">A</tspan><tspan font-size="64">B</tspan>`,
    );
    const back = readBack(svg);
    expect(back.text).toBe('AB\nAB');
    expect(back.runs?.map((r) => r.fontSize)).toEqual([undefined, 64]);
    expect(back.style?.lineHeight).toBe(1.2);
  });

  it('writes today\'s output for a node the layout does not lay out', () => {
    const n = node('AB\nAB', { style: { wrap: true } });
    expect(serializeSvg([n], { ...VIEW, textLayout: () => undefined })).toBe(serializeSvg([n], VIEW));
  });

  it('writes today\'s output when the layout measured nothing', () => {
    _resetFontRegistryForTests();
    const n = node('BA BA BA', { style: { wrap: true } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(laidSvg(n)).toBe(serializeSvg([n], VIEW));
    } finally {
      warn.mockRestore();
    }
  });

  it('lists every face a laid-out text is set in among what to load', () => {
    const n = node('AB', { runs: [{ text: 'A' }, { text: 'B', bold: true }] });
    expect(svgNeeds([n]).fonts).toEqual([]);
    expect(svgNeeds([n], { textLayout: layoutTextPose }).fonts).toEqual([
      { family: 'inter', weight: 400, style: 'normal' },
      { family: 'inter', weight: 700, style: 'normal' },
    ]);
  });
});
