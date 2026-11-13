/**
 * `serializeSvg`'s `text` modes against a real face: the bundled Inter, read
 * by the default parser, so the outlines are glyph geometry and the embedded
 * bytes are a font file.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { boundsOfPath, pathFromD, registerFontOutlines, textFitScale, textToPathsByPaint } from '@weasel-js/core';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import type { OutlineFace } from '@weasel-js/font';
import { serializeSvg } from './serialize';
import { svgLeafFromKit } from './fromKit';
import { warmSvg } from './warm';
import type { SvgNode, SvgTextNode } from './types';

const INTER_TTF = resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf');

function interBytes(): ArrayBuffer {
  const buf = readFileSync(INTER_TTF);
  // Built in this realm: the registry tells a buffer by `instanceof ArrayBuffer`.
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

function tableOffset(bytes: ArrayBuffer, tag: string): number {
  const view = new DataView(bytes);
  for (let i = 0; i < view.getUint16(4); i++) {
    const at = 12 + i * 16;
    if (String.fromCharCode(...[0, 1, 2, 3].map((k) => view.getUint8(at + k))) === tag) return view.getUint32(at + 8);
  }
  throw new Error(`no ${tag} table`);
}

/** Inter with its OS/2 `fsType` set to restricted license: no embedding. */
function lockedBytes(): ArrayBuffer {
  const bytes = interBytes();
  new DataView(bytes).setUint16(tableOffset(bytes, 'OS/2') + 8, 0x0002);
  return bytes;
}

afterEach(() => {
  _resetFontOutlinesForTests();
  _resetFontRegistryForTests();
  _resetLayoutCacheForTests();
});

/** Half-em squares for 'A' and 'B', from a parser with no font file behind it. */
const SQUARES: OutlineFace = {
  unitsPerEm: 1000,
  ascender: 0.8,
  advanceOf: () => 0.6,
  kernOf: () => 0,
  glyphD: (cp) => (cp === 65 || cp === 66 ? 'M0 -0.5L0.5 -0.5L0.5 0L0 0Z' : null),
};

const INK = { paint: { kind: 'solid', color: '#c00' } } as const;

function text(family: string, extra: Partial<SvgTextNode> = {}): SvgTextNode {
  return {
    kind: 'text', x: 10, y: 20, width: 400, height: 100, text: 'Hello',
    style: { fontFamily: family, fontSize: 48 }, fill: INK, ...extra,
  };
}

async function warmed(nodes: SvgNode[], mode: 'outline' | 'embed'): Promise<{ svg: string; warnings: string[] }> {
  await warmSvg(nodes, { text: mode });
  const warnings: string[] = [];
  return { svg: serializeSvg(nodes, { text: mode, onWarn: (m) => warnings.push(m) }), warnings };
}

const pathsIn = (svg: string): string[] => [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]!);

describe("text: 'outline'", () => {
  it('writes a text node set in a registered outline face as its glyph outlines, where the canvas sets them', async () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    const node = text('svg-inter');
    const { svg, warnings } = await warmed([node], 'outline');
    expect(warnings).toEqual([]);
    expect(svg).not.toContain('<text');
    const [d, ...rest] = pathsIn(svg);
    expect(rest).toEqual([]);
    expect(svg).toContain('fill="#c00"');
    const expected = boundsOfPath(textToPathsByPaint(node, node)[0]!.path);
    const written = boundsOfPath(pathFromD(d!));
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(written[k]).toBeCloseTo(expected[k], 2);
    expect(written.x).toBeGreaterThanOrEqual(node.x);
    expect(written.y).toBeGreaterThanOrEqual(node.y);
  });

  it('turns the outlines with the node', async () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    const flat = boundsOfPath(pathFromD(pathsIn((await warmed([text('svg-inter')], 'outline')).svg)[0]!));
    const turned = boundsOfPath(pathFromD(pathsIn((await warmed([text('svg-inter', { rotation: Math.PI / 2 })], 'outline')).svg)[0]!));
    expect(flat.width).toBeGreaterThan(flat.height);
    expect(turned.height).toBeCloseTo(flat.width, 1);
  });

  it('outlines a kit text leaf lowered by svgLeafFromKit', async () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    const leaf = svgLeafFromKit(
      { text: 'Hi', style: { fontFamily: 'svg-inter', fontSize: 32 }, fill: INK },
      { x: 0, y: 0, width: 200, height: 60 },
    )!;
    const { svg } = await warmed([leaf], 'outline');
    expect(svg).not.toContain('<text');
    expect(pathsIn(svg)).toHaveLength(1);
  });

  it('writes a text frame whose text it outlines as a plain group, which reads back as its parts', async () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    const note = svgLeafFromKit(
      { text: 'Hi', style: { fontFamily: 'svg-inter', fontSize: 32 }, fill: INK, background: { paint: { kind: 'solid', color: '#ffe97a' } } },
      { x: 0, y: 0, width: 200, height: 60 },
    )!;
    expect(serializeSvg([note])).toContain('data-weasel-text-frame');
    expect((await warmed([note], 'outline')).svg).not.toContain('data-weasel-text-frame');
  });

  it('keeps a node live, and says so, when its face has no outlines loaded', () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    const warnings: string[] = [];
    const svg = serializeSvg([text('svg-inter')], { text: 'outline', onWarn: (m) => warnings.push(m) });
    expect(svg).toContain('<text');
    expect(warnings.some((w) => w.includes('written as live text'))).toBe(true);
  });
});

describe("text: 'embed'", () => {
  it('keeps the text live and writes one @font-face per face, holding the font file', async () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    const { svg, warnings } = await warmed([text('svg-inter'), text('svg-inter', { text: 'again' })], 'embed');
    expect(warnings).toEqual([]);
    expect(svg.match(/<text/g)).toHaveLength(2);
    expect(svg).toContain('font-family="svg-inter"');
    const rules = [...svg.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]!);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toContain('font-family:"svg-inter";font-weight:400;font-style:normal;');
    const b64 = /url\(data:font\/ttf;base64,([A-Za-z0-9+/=]+)\) format\("truetype"\)/.exec(rules[0]!)![1]!;
    expect(atob(b64).length).toBe(interBytes().byteLength);
  });

  it('names the family a node set in the default face is written in', async () => {
    registerFontOutlines('sans-serif', {}, interBytes());
    const { svg } = await warmed([{ ...text('x'), style: { fontSize: 20 } }], 'embed');
    expect(svg).toContain('font-family="sans-serif"');
    expect(svg).toContain('@font-face{font-family:"sans-serif"');
  });

  it('writes text set in a face whose license forbids embedding as outlines, naming the face', async () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    registerFontOutlines('svg-locked', {}, lockedBytes());
    const { svg, warnings } = await warmed([text('svg-inter'), text('svg-locked')], 'embed');
    expect(svg.match(/<text/g)).toHaveLength(1);
    expect(pathsIn(svg)).toHaveLength(1);
    expect(svg.match(/@font-face/g)).toHaveLength(1);
    expect(svg).not.toContain('"svg-locked"');
    expect(warnings).toEqual(['the face "svg-locked" 400 normal forbids embedding; text set in it is written as outlines']);
  });

  it('writes text set in a face with no font file behind it as outlines, naming the face', async () => {
    registerFontOutlines('svg-bare', {}, interBytes(), { parser: async () => SQUARES });
    const { svg, warnings } = await warmed([text('svg-bare', { text: 'AB' })], 'embed');
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('@font-face');
    expect(warnings).toEqual(['the face "svg-bare" 400 normal has no font file to embed; text set in it is written as outlines']);
  });
});

describe('a text node that shrinks to fit its box', () => {
  const wide = (extra: Partial<SvgTextNode> = {}) =>
    text('svg-inter', { text: 'HEADLINE', width: 300, height: 200, style: { fontFamily: 'svg-inter', fontSize: 100 }, ...extra });

  it('is outlined at the fitted size', async () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    const own = boundsOfPath(pathFromD(pathsIn((await warmed([wide()], 'outline')).svg)[0]!));
    const fitted = boundsOfPath(pathFromD(pathsIn((await warmed([wide({ fit: 'shrink' })], 'outline')).svg)[0]!));
    const k = textFitScale(wide({ fit: 'shrink' }));
    expect(k).toBeLessThan(1);
    expect(own.width).toBeGreaterThan(300);
    expect(fitted.width).toBeLessThanOrEqual(300);
    expect(fitted.width / own.width).toBeCloseTo(k, 2);
  });

  it('is written as live text at the fitted size, and from a kit leaf', async () => {
    registerFontOutlines('svg-inter', {}, interBytes());
    const leaf = svgLeafFromKit(
      { text: 'HEADLINE', style: { fontFamily: 'svg-inter', fontSize: 100 }, fill: INK, fit: 'shrink' },
      { x: 10, y: 20, width: 300, height: 200 },
    ) as SvgTextNode;
    expect(leaf.fit).toBe('shrink');
    await warmSvg([leaf]);
    const size = Number(/font-size="([\d.]+)"/.exec(serializeSvg([leaf]))![1]);
    expect(size).toBeCloseTo(100 * textFitScale(leaf), 3);
  });
});
