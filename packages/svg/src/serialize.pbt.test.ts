/**
 * The exporter: what `serializeSvg` writes is a document its own reader takes without complaint — well formed,
 * every id unique, every reference to a def that exists — and that draws what it was given: each leaf's fill,
 * stroke, opacity, clips, and visibility through `parseSvg`. Geometry has its own property in
 * `roundtrip.geometry.pbt.test.ts`; this one compares the paint.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { boundsOfPath, multiply, transformPath, type Affine, type Path } from '@weasel-js/geom';
import type { Paint } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { IDENTITY_MATRIX, type SvgNode, type SvgPaint, type SvgStroke, type SvgTextNode } from './types';
import { color, isOpen, runs, timeoutFor, tree } from './pbt.fixture';

const N = 120;

/** Every `id`, and every `#id` an attribute names, in `xml`. */
function idsAndRefs(xml: string): { ids: string[]; refs: string[]; doc: Document } {
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  const ids: string[] = [], refs: string[] = [];
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    for (const a of Array.from(el.attributes)) {
      if (a.localName === 'id') ids.push(a.value);
      for (const m of a.value.matchAll(/url\(\s*['"]?#([^)'"\s]+)/g)) refs.push(m[1]!);
      if (a.localName === 'href' && a.value.startsWith('#')) refs.push(a.value.slice(1));
    }
  }
  return { ids, refs, doc };
}

const scaleOf = (m: Affine): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

interface Drawn {
  fill: unknown;
  stroke: unknown;
  opacity: number;
  clips: number[][];
  hidden: boolean;
}


/** `got` deep-equal to `want`, numbers within 1e-3 of each other relatively: a written matrix keeps six decimals. */
function expectClose(got: unknown, want: unknown, at: string): void {
  if (typeof want === 'number' && typeof got === 'number') {
    expect(Math.abs(got - want), `${at}: ${got} vs ${want}`).toBeLessThanOrEqual(1e-3 * Math.max(1, Math.abs(want)));
    return;
  }
  if (want === null || typeof want !== 'object' || got === null || typeof got !== 'object') {
    expect(got, at).toEqual(want);
    return;
  }
  expect(Object.keys(got).sort(), at).toEqual(Object.keys(want).sort());
  for (const k of Object.keys(want)) {
    expectClose((got as Record<string, unknown>)[k], (want as Record<string, unknown>)[k], `${at}.${k}`);
  }
}

function paintKey(p: SvgPaint | undefined, extraOpacity?: number): unknown {
  if (!p || p.kind === 'none') return 'none';
  if (p.kind === 'solid') return { color: p.color, opacity: ((extraOpacity ?? p.opacity ?? 1)) };
  const g: Paint = p.paint;
  return {
    kind: g.kind, stops: 'stops' in g ? g.stops.map((s) => [(s.offset), s.color]) : [], opacity: (extraOpacity ?? g.opacity ?? 1),
    ...('color' in g && g.kind !== 'solid' && g.kind !== undefined ? { color: g.color } : {}),
  };
}

function strokeKey(s: SvgStroke | undefined, m: Affine, closed: boolean): unknown {
  if (!s || s.paint.kind === 'none') return 'none';
  const k = scaleOf(m);
  const w = typeof s.width === 'number' ? s.width : s.width.px;
  return {
    paint: paintKey(s.paint, s.opacity),
    width: (w * k),
    cap: s.cap ?? 'butt', join: s.join ?? 'miter', miterLimit: (s.miterLimit ?? 4),
    // An odd-length list repeats to an even one, SVG's reading of it.
    dash: (s.dash && s.dash.length % 2 === 1 ? [...s.dash, ...s.dash] : s.dash ?? []).map((d) => (d * k)), dashOffset: s.dash?.length ? ((s.dashOffset ?? 0) * k) : 0,
    markers: [closed ? undefined : markerName(s.markerStart), closed ? undefined : markerName(s.markerEnd)],
  };
}

/** A marker reference by the built-in it is: a read-back key is that name and a hash. */
function markerName(ref: SvgStroke['markerStart']): string | undefined {
  if (ref === undefined) return undefined;
  const key = typeof ref === 'string' ? ref : ref.key;
  return key.replace(/-[0-9a-z]{4,}$/, '');
}

const box = (p: Path): number[] => {
  const b = boundsOfPath(p);
  return [b.x, b.y, b.x + b.width, b.y + b.height];
};

/** Each leaf as it is drawn: paints, its opacity times every group's, the world box of each clip above it. */
function drawn(nodes: readonly SvgNode[], parsed: boolean, m: Affine = IDENTITY_MATRIX, o = 1, clips: number[][] = [], hidden = false): Drawn[] {
  return nodes.flatMap((n): Drawn[] => {
    const h = hidden || n.hidden === true;
    if (n.kind === 'group') {
      const mm = !parsed && n.transform ? multiply(m, n.transform) : m;
      const c = n.clip ? [...clips, box(parsed ? n.clip : transformPath(n.clip, mm))] : clips;
      return drawn(n.children, parsed, mm, o * (n.opacity ?? 1), c, h);
    }
    if (n.kind !== 'path') return [];
    const closed = !isOpen(n.path);
    return [{
      fill: paintKey(n.fill), stroke: strokeKey(n.stroke, parsed ? IDENTITY_MATRIX : m, closed),
      opacity: (o * (n.opacity ?? 1)), clips, hidden: h,
    }];
  });
}

describe('serializeSvg, property', () => {
  it('writes a well-formed document whose ids are unique and whose every reference resolves', () => {
    let refs = 0;
    fc.assert(fc.property(tree(), (nodes) => {
      const xml = serializeSvg(nodes);
      const got = idsAndRefs(xml);
      expect(got.doc.getElementsByTagName('parsererror')).toHaveLength(0);
      expect(new Set(got.ids).size, xml).toBe(got.ids.length);
      const known = new Set(got.ids);
      for (const r of got.refs) expect(known.has(r), `#${r} in ${xml}`).toBe(true);
      refs += got.refs.length;
    }), runs(N));
    expect(refs).toBeGreaterThan(runs(N).numRuns);
  }, timeoutFor(N, 30));

  it('writes nothing its reader warns about', () => {
    fc.assert(fc.property(tree(), (nodes) => {
      const said: string[] = [];
      const xml = serializeSvg(nodes, { onWarn: (w) => said.push(w) });
      expect(said).toEqual([]);
      expect(parseSvg(xml, { keepHidden: true }).warnings, xml).toEqual([]);
    }), runs(N));
  }, timeoutFor(N, 30));

  it('draws what it was given: every leaf keeps its paints, opacity, clips, and visibility', () => {
    let leaves = 0;
    fc.assert(fc.property(tree(), (nodes) => {
      const xml = serializeSvg(nodes);
      const back = parseSvg(xml, { keepHidden: true });
      const want = drawn(nodes, false), got = drawn(back.nodes, true);
      expectClose(got, want, xml);
      leaves += want.length;
    }), runs(N));
    expect(leaves).toBeGreaterThan(runs(N).numRuns * 2);
  }, timeoutFor(N, 40));
});

/** Characters XML 1.0 cannot hold, which the writer replaces; a vertical tab or form feed becomes a line break. */
const NOT_XML = /[\u0000-\u0008\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const written = (s: string): string => s.replace(/[\u000B\u000C]/g, '\n').replace(new RegExp(NOT_XML, 'g'), '\uFFFD');

const chars = fc.constantFrom('a', 'b', ' ', '\n', '\t', '\r', '&', '<', '>', '"', "'", '\u00e9', '\u4e2d', '\u{1F600}',
  '\u00a0', '\u2028', '\u000B', '\u0001', '\u0000', '\uD800', '\uDC00', '\uFFFE');
const run = fc.record({
  text: fc.string({ unit: chars, minLength: 1, maxLength: 6 }),
  bold: fc.option(fc.constant(true), { nil: undefined }),
  italic: fc.option(fc.constant(true), { nil: undefined }),
  underline: fc.option(fc.constant(true), { nil: undefined }),
  fontSize: fc.option(fc.integer({ min: 4, max: 40 }), { nil: undefined }),
  fill: fc.option(color.map((c) => ({ paint: { kind: 'solid' as const, color: c } })), { nil: undefined }),
});
const textNode = fc.record({ runs: fc.array(run, { minLength: 1, maxLength: 4 }), fontSize: fc.integer({ min: 4, max: 40 }), fill: color })
  .map(({ runs: rs, fontSize, fill }): SvgTextNode => ({
    kind: 'text', x: 1, y: 2, width: 100, height: 40, text: rs.map((r) => r.text).join(''),
    style: { fontSize, fontFamily: 'Inter' }, fill: { paint: { kind: 'solid', color: fill } },
    runs: rs.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as { text: string }),
  }));

/** Each character as drawn, line breaks aside (a break's own style draws nothing): it and the style it takes. */
function styledChars(t: SvgTextNode, text: (s: string) => string = (s) => s): unknown[] {
  return (t.runs ?? [{ text: t.text }]).flatMap((r) => Array.from(text(r.text)).filter((ch) => ch !== '\n').map((ch) => [
    ch, r.bold ?? false, r.italic ?? false, r.underline ?? false, r.fontSize ?? t.style?.fontSize, r.fill ?? t.fill,
  ]));
}

describe('serializeSvg on text runs, property', () => {
  it('keeps every character and the style each takes, writing U+FFFD for any XML cannot hold, and warning', () => {
    let replaced = 0;
    fc.assert(fc.property(textNode, (t) => {
      const said: string[] = [];
      const xml = serializeSvg([t], { onWarn: (w) => said.push(w) });
      const out = parseSvg(xml);
      expect(out.warnings, xml).toEqual([]);
      const back = out.nodes[0] as SvgTextNode;
      // Each run is written on its own, so a pair split across two is two halves.
      expect(back.text, xml).toBe(t.runs!.map((r) => written(r.text)).join(''));
      expect(styledChars(back), xml).toEqual(styledChars(t, written));
      const lossy = t.runs!.some((r) => NOT_XML.test(r.text));
      if (lossy) replaced++;
      expect(said.some((w) => w.includes('U+FFFD')), xml).toBe(lossy);
    }), runs(N));
    expect(replaced).toBeGreaterThan(runs(N).numRuns / 10);
  }, timeoutFor(N, 20));
});
