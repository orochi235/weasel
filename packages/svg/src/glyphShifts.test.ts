import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { bidi } from '@weasel-js/bidi';
import { registerBidi } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';

const text = (body: string): { node: SvgTextNode; warnings: string[] } => {
  const { nodes, warnings } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  return { node: nodes[0] as SvgTextNode, warnings };
};
const spacing = (node: SvgTextNode) => node.runs?.map((r) => [r.text, r.letterSpacing]);

describe('a tspan dx list read as letter spacing', () => {
  it('gives each glyph the shift of the glyph after it as extra advance', () => {
    const even = text('<text x="10" y="5"><tspan dx="0 2 2">abc</tspan></text>');
    expect(even.warnings).toEqual([]);
    expect(even.node.text).toBe('abc');
    expect(spacing(even.node)).toEqual([['ab', 2], ['c', undefined]]);

    const kerned = text('<text x="10" y="5"><tspan dx="0 1 -0.5 0 3">abcde</tspan></text>');
    expect(spacing(kerned.node)).toEqual([['a', 1], ['b', -0.5], ['c', undefined], ['d', 3], ['e', undefined]]);
  });

  it('stops at the end of a list shorter than the text', () => {
    expect(spacing(text('<text><tspan dx="0 2">abcd</tspan></text>').node)).toEqual([['a', 2], ['bcd', undefined]]);
  });

  it('lands a leading shift on the glyph before the tspan', () => {
    const { node, warnings } = text('<text x="10" y="5">ab<tspan dx="4">cd</tspan></text>');
    expect(warnings).toEqual([]);
    expect(spacing(node)).toEqual([['a', undefined], ['b', 4], ['cd', undefined]]);
    expect(node.text).toBe('abcd');
  });

  it('moves the text by a leading shift that opens it', () => {
    const { node, warnings } = text('<text x="10" y="5"><tspan dx="3 1">ab</tspan></text>');
    expect(warnings).toEqual([]);
    expect(node.x).toBeCloseTo(13);
    expect(spacing(node)).toEqual([['a', 1], ['b', undefined]]);
  });

  it('adds to the letter spacing already in force', () => {
    const { node } = text('<text letter-spacing="1"><tspan dx="0 2">ab</tspan><tspan letter-spacing="5" dx="0 2">cd</tspan></text>');
    expect(spacing(node)).toEqual([['a', 3], ['b', undefined], ['c', 7], ['d', 5]]);
  });

  it('reads a shift in ems of the tspan font size', () => {
    expect(spacing(text('<text font-size="10"><tspan dx="0 0.5em">ab</tspan></text>').node)).toEqual([['a', 5], ['b', undefined]]);
  });

  it('survives export and import', () => {
    const { node } = text('<text x="10" y="5"><tspan dx="0 2 2">abc</tspan></text>');
    const back = parseSvg(serializeSvg([node])).nodes[0] as SvgTextNode;
    expect(spacing(back)).toEqual([['ab', 2], ['c', undefined]]);
  });

  it('says so where a leading shift opens a later line, which the model starts at the box edge', () => {
    const { node, warnings } = text('<text><tspan x="0" dy="0">A</tspan><tspan x="0" dy="20" dx="3 1">BC</tspan></text>');
    expect(node.text).toBe('A\nBC');
    expect(warnings).toEqual([expect.stringMatching(/dx="3 1"/)]);
    expect(spacing(node)).toEqual([['A', undefined], ['\nB', 1], ['C', undefined]]);
  });

  it('leaves a list unread, and says so, where collapsing white space would move its glyphs', () => {
    const { node, warnings } = text('<text><tspan dx="0 2 2"> a  b</tspan></text>');
    expect(node.text).toBe('a b');
    expect(warnings).toEqual([expect.stringMatching(/dx="0 2 2"/)]);
  });
  it('reads a dx list on a text holding only text, the same way', () => {
    const { node, warnings } = text('<text x="10" y="5" dx="3 1 2">abc</text>');
    expect(warnings).toEqual([]);
    expect(node.x).toBeCloseTo(13);
    expect(node.text).toBe('abc');
    expect(spacing(node)).toEqual([['a', 1], ['b', 2], ['c', undefined]]);
  });
});

// FIXTURE_FONT at 32: A advances 23 and B 22, and A kerns -1 before B, so 'ABA' lays its glyphs at 0, 22 and 44.
describe('a per-glyph x list, where a loaded face measures the glyphs', () => {
  const realFetch = global.fetch;
  const realBitmap = global.createImageBitmap;
  beforeEach(async () => {
    _resetFontRegistryForTests();
    global.fetch = vi.fn().mockImplementation((url: string) => url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
      : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob([new Uint8Array(3)], { type: 'image/png' })) })) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
    await registerFont('inter', {}, '/f/inter.json', '/f/inter.png');
  });
  afterEach(() => {
    _resetFontRegistryForTests();
    global.fetch = realFetch;
    global.createImageBitmap = realBitmap;
  });
  const set = (attrs: string, body = 'ABA') =>
    text(`<text font-family="inter" font-size="32" y="40"><tspan ${attrs}>${body}</tspan></text>`);

  it('reads each position as the spacing that puts the glyph there', () => {
    const { node, warnings } = set('x="0 30 50"');
    expect(warnings).toEqual([]);
    expect(spacing(node)).toEqual([['A', 8], ['B', -2], ['A', undefined]]);
  });

  it('lets the glyphs past a short list flow on', () => {
    expect(spacing(set('x="0 30"').node)).toEqual([['A', 8], ['BA', undefined]]);
  });

  it('adds a dx list on top of the positions', () => {
    expect(spacing(set('x="0 30 50" dx="0 1"').node)).toEqual([['A', 9], ['B', -3], ['A', undefined]]);
  });

  it('reads the list on a text holding only text the same way', () => {
    const { node, warnings } = text('<text font-family="inter" font-size="32" x="5 35 55" y="40">ABA</text>');
    expect(warnings).toEqual([]);
    expect(node.x).toBeCloseTo(5);
    expect(spacing(node)).toEqual([['A', 8], ['B', -2], ['A', undefined]]);
  });

  it('reads a text\'s list through its tspans, measuring the glyphs across runs', () => {
    const { node, warnings } = text('<text font-family="inter" font-size="32" x="5 35 55" y="40">A<tspan fill="red">BA</tspan></text>');
    expect(warnings).toEqual([]);
    expect(node.x).toBeCloseTo(5);
    expect(node.text).toBe('ABA');
    expect(spacing(node)).toEqual([['A', 8], ['B', -2], ['A', undefined]]);
  });

  it('measures each glyph in its own run\'s size', () => {
    // B at 16 advances 11, half of what it does at 32.
    const { node, warnings } = text('<text font-family="inter" font-size="32" x="0 30 50" y="40">A<tspan font-size="16">B</tspan>A</text>');
    expect(warnings).toEqual([]);
    expect(spacing(node)).toEqual([['A', 8], ['B', 9], ['A', undefined]]);
  });

  it('adds the text\'s dx list on top of its positions', () => {
    const { node } = text('<text font-family="inter" font-size="32" x="0 30 50" dx="0 1" y="40">A<tspan fill="red">BA</tspan></text>');
    expect(spacing(node)).toEqual([['A', 9], ['B', -3], ['A', undefined]]);
  });

  it('leaves a text\'s list unread, and says why, where a tspan it reaches has its own x', () => {
    const { node, warnings } = text('<text font-family="inter" font-size="32" x="0 30 50" y="40">A<tspan x="30">BA</tspan></text>');
    expect(warnings).toEqual([expect.stringMatching(/<text x="0 30 50"> positions each glyph; only the first value is read: a <tspan> it reaches has its own x/)]);
    expect(node.runs).toBeUndefined();
  });
});

describe('a per-glyph x list with no face loaded', () => {
  it('is left unread on a text holding tspans, and says why', () => {
    const { warnings } = text('<text font-size="32" x="0 30 50">A<tspan fill="red">BA</tspan></text>');
    expect(warnings).toEqual([expect.stringMatching(/<text x="0 30 50"> positions each glyph; only the first value is read: no loaded face/)]);
  });

  it('is left unread, and says so', () => {
    const { node, warnings } = text('<text font-size="32"><tspan x="0 30 50">ABA</tspan></text>');
    expect(warnings).toEqual([expect.stringMatching(/x="0 30 50"> positions each glyph; only the first value is read/)]);
    expect(node.runs).toBeUndefined();
  });
});

describe('a dx list on a text holding tspans', () => {
  it('hands each value to the glyph it counts to, through the text and its tspans', () => {
    const { node, warnings } = text('<text x="10" y="5" dx="3 1 2 4">ab<tspan font-weight="700">cd</tspan></text>');
    expect(warnings).toEqual([]);
    expect(node.x).toBeCloseTo(13);
    expect(node.text).toBe('abcd');
    expect(spacing(node)).toEqual([['a', 1], ['b', 2], ['c', 4], ['d', undefined]]);
  });

  it('lets a tspan\'s own values replace the text\'s where it has them', () => {
    const { node } = text('<text dx="0 1 1 1">ab<tspan dx="5">cd</tspan></text>');
    expect(spacing(node)).toEqual([['a', 1], ['b', 5], ['c', 1], ['d', undefined]]);
  });

  it('leaves the list unread, and says so, where collapsing white space would move its glyphs', () => {
    const { node, warnings } = text('<text dx="0 1">\n  <tspan>ab</tspan>\n</text>');
    expect(node.text).toBe('ab');
    expect(warnings).toEqual([expect.stringMatching(/<text dx="0 1"> is not read/)]);
    expect(node.runs).toBeUndefined();
  });
});

// The fixture's A and B again as Hebrew alef and bet, so 'אבא' lays out right to
// left with the same advances and kerning, its glyphs' right edges at 0, -22 and -44.
describe('glyph lists in right-to-left text', () => {
  const realFetch = global.fetch;
  const realBitmap = global.createImageBitmap;
  const hebrew: Record<number, number> = { 65: 0x5d0, 66: 0x5d1 };
  const font = {
    ...FIXTURE_FONT,
    chars: [...FIXTURE_FONT.chars, ...FIXTURE_FONT.chars.map((c) => ({ ...c, id: hebrew[c.id]! }))],
    kernings: [
      ...FIXTURE_FONT.kernings,
      ...FIXTURE_FONT.kernings.map((k) => ({ ...k, first: hebrew[k.first]!, second: hebrew[k.second]! })),
    ],
  };
  let unregister: (() => void) | null = null;
  beforeEach(async () => {
    _resetFontRegistryForTests();
    global.fetch = vi.fn().mockImplementation((url: string) => url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(font) })
      : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob([new Uint8Array(3)], { type: 'image/png' })) })) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
    await registerFont('inter', {}, '/f/inter.json', '/f/inter.png');
  });
  afterEach(() => {
    unregister?.();
    unregister = null;
    _resetFontRegistryForTests();
    global.fetch = realFetch;
    global.createImageBitmap = realBitmap;
  });
  const rtl = (attrs: string, body = 'אבא') =>
    text(`<text direction="rtl" font-family="inter" font-size="32" x="100" y="40"><tspan ${attrs}>${body}</tspan></text>`);

  it('reads a dx toward +x as narrowing the gap before the glyph', () => {
    unregister = registerBidi(bidi);
    const { node, warnings } = rtl('dx="0 2"');
    expect(warnings).toEqual([]);
    expect(spacing(node)).toEqual([['א', -2], ['בא', undefined]]);
  });

  it('reads each x position as the spacing that puts the glyph\'s right edge there', () => {
    unregister = registerBidi(bidi);
    const { node, warnings } = rtl('x="100 70 50"');
    expect(warnings).toEqual([]);
    expect(spacing(node)).toEqual([['א', 8], ['ב', -2], ['א', undefined]]);
  });

  it('moves the whole text toward +x by a leading shift', () => {
    unregister = registerBidi(bidi);
    const plain = rtl('').node;
    const moved = rtl('dx="3"').node;
    expect(moved.x - plain.x).toBeCloseTo(3);
  });

  it('is left unread, and says so, where a glyph reads left to right', () => {
    unregister = registerBidi(bidi);
    const { node, warnings } = rtl('dx="0 2"', 'אA');
    expect(warnings).toEqual([expect.stringMatching(/<tspan dx="0 2"> is not read: in right-to-left text/)]);
    expect(node.runs).toBeUndefined();
  });

  it('is left unread, and says so, with no bidi engine to say which way the glyphs read', () => {
    const { node, warnings } = rtl('dx="0 2"');
    expect(warnings).toEqual([expect.stringMatching(/<tspan dx="0 2"> is not read: in right-to-left text/)]);
    expect(node.runs).toBeUndefined();
  });
});
