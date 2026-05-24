/**
 * Golden round-trip tests: for each fixture, assert that
 * `parseSvg(serializeSvg(parseSvg(svg).nodes)).nodes` deep-equals
 * `parseSvg(svg).nodes`. The intermediate SVG bytes don't have to match
 * the input — only the parsed shape must round-trip.
 *
 * Floats are rounded to 3 decimals during normalization so that the
 * trimNumber serializer (6 decimals) plus the arc→cubic conversion
 * (transcendental math) don't trip equality.
 */

import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgNode } from './index';
import * as F from './__fixtures__/fixtures';

interface NormalizedPath {
  kind: 'path';
  /**
   * RectPath and the equivalent 4-line PolygonPath collapse to the same
   * `polygon` shape during normalization — the data model treats them
   * interchangeably and the SVG serializer always lowers rects to
   * `<path d="M h v h Z">`, which parses back as a polygon.
   */
  commands: number[];
  coords: number[];
  fillRule: string;
  fill: unknown;
  stroke?: unknown;
  opacity?: number;
}

interface NormalizedGroup {
  kind: 'group';
  children: NormalizedNode[];
  transform?: number[];
  opacity?: number;
}

interface NormalizedText {
  kind: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  runs?: unknown;
  style?: unknown;
  opacity?: number;
}

type NormalizedNode = NormalizedPath | NormalizedGroup | NormalizedText;

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function normalize(node: SvgNode): NormalizedNode {
  if (node.kind === 'group') {
    const out: NormalizedGroup = {
      kind: 'group',
      children: node.children.map(normalize),
    };
    if (node.transform) out.transform = Array.from(node.transform).map(round);
    if (node.opacity != null) out.opacity = round(node.opacity);
    return out;
  }
  if (node.kind === 'text') {
    const out: NormalizedText = {
      kind: 'text',
      x: round(node.x),
      y: round(node.y),
      width: round(node.width),
      height: round(node.height),
      text: node.text,
    };
    if (node.runs) out.runs = node.runs;
    if (node.style) out.style = node.style;
    if (node.opacity != null) out.opacity = round(node.opacity);
    return out;
  }
  const path = node.path;
  let commands: number[];
  let coords: number[];
  let fillRule: string;
  if (path.kind === 'rect') {
    // M h v h Z lowering — matches what the serializer emits for rects.
    commands = [0, 1, 1, 1, 4]; // PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z
    coords = [
      path.x, path.y,
      path.x + path.width, path.y,
      path.x + path.width, path.y + path.height,
      path.x, path.y + path.height,
    ].map(round);
    fillRule = 'nonzero';
  } else {
    commands = Array.from(path.commands as Uint8Array);
    coords = Array.from(path.coords as Float32Array).map(round);
    fillRule = path.fillRule;
  }
  const norm: NormalizedPath = {
    kind: 'path',
    commands,
    coords,
    fillRule,
    fill: node.fill,
  };
  if (node.stroke) norm.stroke = node.stroke;
  if (node.opacity != null) norm.opacity = round(node.opacity);
  return norm;
}

function normalizeAll(nodes: SvgNode[]): NormalizedNode[] {
  return nodes.map(normalize);
}

function roundTrip(svg: string): { a: NormalizedNode[]; b: NormalizedNode[]; warnings: string[] } {
  const first = parseSvg(svg);
  const out = serializeSvg(first.nodes);
  const second = parseSvg(out);
  return {
    a: normalizeAll(first.nodes),
    b: normalizeAll(second.nodes),
    warnings: [...first.warnings, ...second.warnings],
  };
}

describe('round-trip', () => {
  it('rect', () => {
    const { a, b, warnings } = roundTrip(F.RECT_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('all primitive shapes', () => {
    const { a, b } = roundTrip(F.SHAPES_SVG);
    expect(b).toEqual(a);
  });

  it('nested SVG <g> with transforms', () => {
    const { a, b } = roundTrip(F.NESTED_GROUPS_SVG);
    expect(b).toEqual(a);
  });

  it('gradient-filled path', () => {
    const { a, b } = roundTrip(F.GRADIENT_SVG);
    expect(b).toEqual(a);
  });

  it('multi-contour path', () => {
    const { a, b } = roundTrip(F.MULTI_CONTOUR_SVG);
    expect(b).toEqual(a);
  });

  it('curves (C/S/Q/T)', () => {
    const { a, b } = roundTrip(F.CURVES_SVG);
    expect(b).toEqual(a);
  });

  it('rounded rect', () => {
    const { a, b } = roundTrip(F.ROUNDED_RECT_SVG);
    expect(b).toEqual(a);
  });

  it('arc command', () => {
    const { a, b } = roundTrip(F.ARC_SVG);
    expect(b).toEqual(a);
  });

  it('stroke styling (linecap, linejoin, dasharray)', () => {
    const { a, b, warnings } = roundTrip(F.STROKE_STYLE_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('plain text', () => {
    const { a, b, warnings } = roundTrip(F.TEXT_PLAIN_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('text with styled runs (tspan)', () => {
    const { a, b, warnings } = roundTrip(F.TEXT_RUNS_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('text style: font-size/family/weight/italic/align + fill round-trip', () => {
    const namespaces = { wd: 'https://weaseldraw.app/svg-ext' };
    const first = parseSvg(F.TEXT_STYLE_FULL_SVG, { namespaces });
    expect(first.warnings).toEqual([]);
    expect(first.nodes).toHaveLength(1);
    const t = first.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.fontSize).toBe(18);
    expect(t.style?.fontFamily).toBe('Inter, sans-serif');
    expect(t.style?.fontWeight).toBe(700);
    expect(t.style?.fontStyle).toBe('italic');
    expect(t.style?.align).toBe('center');
    expect(t.style?.fill).toEqual({ fill: 'solid', color: '#b03030' });
    // lineHeight rides on meta.wd.attrs['line-height'] — interpreted by
    // svgInterop, not by weasel-svg. From weasel-svg's perspective the
    // value is just a string in the meta bag.
    expect(t.meta?.wd?.attrs?.['line-height']).toBe('1.4');

    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 200, height: 100 },
      namespaces,
    });
    expect(out).toContain('font-size="18"');
    expect(out).toContain('font-family="Inter, sans-serif"');
    expect(out).toContain('font-weight="700"');
    expect(out).toContain('font-style="italic"');
    expect(out).toContain('text-anchor="middle"');
    expect(out).toContain('wd:line-height="1.4"');
    expect(out).toContain('fill="#b03030"');
    // Legacy attribute is gone — no compat-write either.
    expect(out).not.toContain('data-weasel-line-height');

    const second = parseSvg(out, { namespaces });
    const t2 = second.nodes[0];
    if (t2.kind !== 'text') throw new Error('expected text');
    expect(t2.style).toEqual(t.style);
    expect(t2.meta?.wd?.attrs?.['line-height']).toBe('1.4');
  });

  it('generic namespace pass-through: two declared namespaces stay isolated', () => {
    const namespaces = {
      foo: 'https://example.com/foo',
      bar: 'https://example.com/bar',
    };
    const first = parseSvg(F.TWO_NAMESPACES_SVG, { namespaces });
    expect(first.warnings).toEqual([]);

    // Document-level: each prefix has its own attrs bucket.
    expect(first.documentMeta?.foo?.attrs?.rootAttr).toBe('alpha');
    expect(first.documentMeta?.bar?.attrs?.rootAttr).toBe('beta');
    // Document-level: foo has a <registry> element with two <item> children;
    // bar has no document-level elements.
    expect(first.documentMeta?.foo?.elements?.registry).toBeDefined();
    expect(first.documentMeta?.foo?.elements!.registry[0].children?.item).toHaveLength(2);
    expect(first.documentMeta?.foo?.elements!.registry[0].children!.item[0].attrs.id).toBe('a');
    expect(first.documentMeta?.bar?.elements).toBeUndefined();

    // Per-element: <g> has foo:group + bar:tag; the inner <path> has foo:annotation.
    const g = first.nodes[0];
    if (g.kind !== 'group') throw new Error('expected group');
    expect(g.meta?.foo?.attrs?.group).toBe('g1');
    expect(g.meta?.bar?.attrs?.tag).toBe('left');
    const leaf = g.children[0];
    expect(leaf.meta?.foo?.attrs?.annotation).toBe('leaf');

    // Serialize back: prefixes survive, attribute values survive, the
    // <registry> sub-tree comes back. Undeclared namespaces would be
    // silently dropped — but we declared both.
    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      namespaces,
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('xmlns:foo="https://example.com/foo"');
    expect(out).toContain('xmlns:bar="https://example.com/bar"');
    expect(out).toContain('foo:rootAttr="alpha"');
    expect(out).toContain('bar:rootAttr="beta"');
    expect(out).toContain('foo:group="g1"');
    expect(out).toContain('bar:tag="left"');
    expect(out).toContain('foo:annotation="leaf"');
    expect(out).toContain('<foo:registry>');
    expect(out).toContain('<foo:item id="a" name="Alpha"');

    // Second parse equals first parse on every namespaced field.
    const second = parseSvg(out, { namespaces });
    expect(second.documentMeta).toEqual(first.documentMeta);
    const g2 = second.nodes[0];
    if (g2.kind !== 'group') throw new Error('expected group');
    expect(g2.meta).toEqual(g.meta);
    expect(g2.children[0].meta).toEqual(leaf.meta);
  });

  it('document-level metadata: viewBox, wd:paperSize, wd:units, title', () => {
    const namespaces = { wd: 'https://weaseldraw.app/svg-ext' };
    const first = parseSvg(F.WEASELDRAW_MINIMAL_SVG, { namespaces });
    expect(first.viewBox).toEqual({ x: 0, y: 0, width: 816, height: 1056 });
    expect(first.documentMeta?.wd?.attrs?.paperSize).toBe('letter');
    expect(first.documentMeta?.wd?.attrs?.units).toBe('px');
    expect(first.title).toBe('My Doc');

    const out = serializeSvg(first.nodes, {
      viewBox: first.viewBox,
      width: first.viewBox!.width,
      height: first.viewBox!.height,
      title: first.title,
      namespaces,
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('xmlns:wd="https://weaseldraw.app/svg-ext"');
    expect(out).toContain('width="816"');
    expect(out).toContain('height="1056"');
    expect(out).toContain('wd:paperSize="letter"');
    expect(out).toContain('wd:units="px"');
    expect(out).toContain('<title>My Doc</title>');

    const second = parseSvg(out, { namespaces });
    expect(second.viewBox).toEqual(first.viewBox);
    expect(second.documentMeta?.wd?.attrs?.paperSize).toBe('letter');
    expect(second.title).toBe('My Doc');
  });

  it('paper-size preset: A4', () => {
    const namespaces = { wd: 'https://weaseldraw.app/svg-ext' };
    const r = parseSvg(F.WEASELDRAW_PAPERS_SVG, { namespaces });
    expect(r.documentMeta?.wd?.attrs?.paperSize).toBe('a4');
    expect(r.viewBox).toEqual({ x: 0, y: 0, width: 794, height: 1123 });
  });

  it('groups with wd:group-id round-trip', () => {
    const namespaces = { wd: 'https://weaseldraw.app/svg-ext' };
    const first = parseSvg(F.WEASELDRAW_GROUPS_SVG, { namespaces });
    expect(first.warnings).toEqual([]);
    expect(first.nodes).toHaveLength(2);
    expect(first.nodes[0].kind).toBe('group');
    const g0 = first.nodes[0];
    if (g0.kind !== 'group') throw new Error('expected group');
    expect(g0.meta?.wd?.attrs?.['group-id']).toBe('g1');
    expect(g0.children).toHaveLength(3);

    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 400, height: 400 },
      namespaces,
    });
    expect(out).toContain('wd:group-id="g1"');
    expect(out).toContain('wd:group-id="g2"');

    const second = parseSvg(out, { namespaces });
    expect(second.nodes).toHaveLength(2);
    const s0 = second.nodes[0];
    if (s0.kind !== 'group') throw new Error('expected group');
    expect(s0.meta?.wd?.attrs?.['group-id']).toBe('g1');
    expect(s0.children).toHaveLength(3);
  });

  it('generic namespace pass-through: undeclared namespaces are dropped on serialize', () => {
    // Parse declaring only `foo`. The `bar:*` content lives in the source
    // XML DOM but is not promoted into `meta`. When we re-serialize, the
    // bar attributes vanish — there is no `meta.bar` for the writer to find.
    const first = parseSvg(F.TWO_NAMESPACES_SVG, { namespaces: { foo: 'https://example.com/foo' } });
    expect(first.documentMeta?.foo).toBeDefined();
    expect(first.documentMeta?.bar).toBeUndefined();
    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      namespaces: { foo: 'https://example.com/foo' },
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('foo:rootAttr="alpha"');
    expect(out).not.toContain('bar:rootAttr');
    expect(out).not.toContain('xmlns:bar');
  });
});

describe('rotation round-trip', () => {
  it('emits transform=rotate(angle cx cy) when SvgPathNode has rotation', () => {
    const node: SvgNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 },
      fill: { kind: 'solid', color: '#3366ff' },
      rotation: Math.PI / 6,
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    expect(svg).toContain('transform="rotate(30 50 25)"');
  });

  it('omits transform when rotation is 0 or undefined', () => {
    const node: SvgNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 },
      fill: { kind: 'solid', color: '#3366ff' },
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    expect(svg).not.toContain('transform=');
  });

  it('emits transform=rotate for rotated SvgTextNode using its declared box center', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 100, y: 50, width: 200, height: 40,
      text: 'Hi',
      rotation: Math.PI / 4,
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 400, height: 200 } });
    expect(svg).toMatch(/transform="rotate\(45 200 70\)"/);
  });
});

describe('rotation round-trip — parse', () => {
  it('round-trips a rotated rect lossless: parse(serialize(node)) == node', () => {
    const node: SvgNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 },
      fill: { kind: 'solid', color: '#3366ff' },
      rotation: Math.PI / 6,
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    const parsed = parseSvg(svg);
    expect(parsed.nodes).toHaveLength(1);
    const out = parsed.nodes[0];
    expect(out.kind).toBe('path');
    if (out.kind !== 'path') throw new Error('unreachable');
    expect(out.path.kind).toBe('rect');
    const rect = out.path as { kind: 'rect'; x: number; y: number; width: number; height: number };
    expect(rect.x).toBeCloseTo(0, 5);
    expect(rect.y).toBeCloseTo(0, 5);
    expect(rect.width).toBeCloseTo(100, 5);
    expect(rect.height).toBeCloseTo(50, 5);
    expect(out.rotation).toBeCloseTo(Math.PI / 6, 5);
  });

  it('round-trips a rotated text node lossless: parse(serialize(node)) == node', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 100, y: 50, width: 200, height: 40,
      text: 'Hi',
      rotation: Math.PI / 4,
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 400, height: 200 } });
    const parsed = parseSvg(svg);
    expect(parsed.nodes).toHaveLength(1);
    const out = parsed.nodes[0];
    expect(out.kind).toBe('text');
    if (out.kind !== 'text') throw new Error('unreachable');
    expect(out.x).toBeCloseTo(100, 5);
    expect(out.y).toBeCloseTo(50, 5);
    expect(out.width).toBeCloseTo(200, 5);
    expect(out.height).toBeCloseTo(40, 5);
    expect(out.rotation).toBeCloseTo(Math.PI / 4, 5);
  });

  it('emits a warning when a leaf transform mixes scale+rotate (un-decomposable to pure rotation)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <path d="M 0 0 L 100 0 L 100 50 L 0 50 Z" fill="#3366ff"
            transform="translate(10 20) rotate(30) scale(0.5)"/>
    </svg>`;
    const parsed = parseSvg(svg);
    expect(parsed.warnings.some((w) => /rotation/i.test(w))).toBe(true);
  });

  it('save → load → save is byte-identical for a WeaselDraw-authored rotated rect', () => {
    const node: SvgNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 },
      fill: { kind: 'solid', color: '#3366ff' },
      rotation: Math.PI / 6,
    };
    const svg1 = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    const parsed = parseSvg(svg1);
    const svg2 = serializeSvg(parsed.nodes, { viewBox: parsed.viewBox });
    expect(svg2).toBe(svg1);
  });
});
