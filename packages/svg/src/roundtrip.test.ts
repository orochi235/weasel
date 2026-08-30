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
import { resolveAlign } from '@weasel-js/core';
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

interface NormalizedImage {
  kind: 'image';
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  rotation?: number;
}

type NormalizedNode = NormalizedPath | NormalizedGroup | NormalizedText | NormalizedImage;

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
  if (node.kind === 'image') {
    const out: NormalizedImage = {
      kind: 'image',
      href: node.href,
      x: round(node.x),
      y: round(node.y),
      width: round(node.width),
      height: round(node.height),
    };
    if (node.opacity != null) out.opacity = round(node.opacity);
    if (node.rotation != null) out.rotation = round(node.rotation);
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

  it('gradientUnits survives both directions', () => {
    const { a, b, warnings } = roundTrip(F.GRADIENT_UNITS_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
    // The serializer used to hardcode `userSpaceOnUse`, so an
    // objectBoundingBox gradient came back reading its 0..1 geometry as page
    // coordinates — a gradient the size of a pixel.
    const fills = a.map((n) => (n as { fill?: { paint?: { units?: string } } }).fill?.paint?.units);
    expect(fills).toEqual(['bounds', 'world']);
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

  it('stroke markers (start, mid, end)', () => {
    const { a, b, warnings } = roundTrip(F.MARKER_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('plain text', () => {
    const { a, b, warnings } = roundTrip(F.TEXT_PLAIN_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('<image> (data URI, external URL, xlink:href)', () => {
    const { a, b, warnings } = roundTrip(F.IMAGE_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
    expect(a).toEqual([
      // Group transform collapses onto the box: translate(10 20) scale(2).
      {
        kind: 'group',
        children: [
          { kind: 'image', href: 'data:image/png;base64,iVBORw0KGgo=', x: 20, y: 30, width: 60, height: 40 },
        ],
      },
      {
        kind: 'image', href: 'https://example.com/photo.jpg',
        x: 100, y: 100, width: 80, height: 60,
        opacity: 0.5, rotation: round(Math.PI / 6),
      },
      { kind: 'image', href: 'legacy.png', x: 200, y: 200, width: 40, height: 40 },
    ]);
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
    expect(t.fill).toEqual({ fill: 'solid', color: '#b03030' });
    expect(t.style?.letterSpacing).toBe(1.5);
    expect(t.style?.underline).toBe(true);
    expect(t.style?.strikethrough).toBe(true);
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
    expect(out).toContain('letter-spacing="1.5"');
    expect(out).toContain('text-decoration="underline line-through"');
    // Legacy attribute is gone — no compat-write either.
    expect(out).not.toContain('data-weasel-line-height');

    const second = parseSvg(out, { namespaces });
    const t2 = second.nodes[0];
    if (t2.kind !== 'text') throw new Error('expected text');
    expect(t2.style).toEqual(t.style);
    expect(t2.meta?.wd?.attrs?.['line-height']).toBe('1.4');
  });

  /**
   * Text strokes used to be dropped on parse with a warning, because the
   * renderer had nothing to stroke — an SDF glyph is a sampled field, not
   * geometry. The outline tier changed that, so they now round-trip like any
   * other paint.
   */
  it('text stroke: node-level and per-run, with joins/caps/dashes', () => {
    const first = parseSvg(F.TEXT_STROKE_SVG);
    expect(first.warnings).toEqual([]);
    const t = first.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');

    expect(t.stroke).toEqual({
      paint: { fill: 'solid', color: '#c0392b' },
      width: 3,
      join: 'round',
      cap: 'round',
      miterLimit: 6,
      dash: [4, 2],
    });
    // The run overrides colour and width and inherits nothing else — a run's
    // stroke replaces the node's rather than merging with it.
    expect(t.runs?.[1].stroke).toEqual({
      paint: { fill: 'solid', color: '#1e90ff' },
      width: 1.5,
    });

    const out = serializeSvg(first.nodes, { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(out).toContain('stroke="#c0392b"');
    expect(out).toContain('stroke-width="3"');
    expect(out).toContain('stroke-linejoin="round"');
    expect(out).toContain('stroke-linecap="round"');
    expect(out).toContain('stroke-miterlimit="6"');
    expect(out).toContain('stroke-dasharray="4 2"');
    expect(out).toContain('stroke="#1e90ff"');

    const second = parseSvg(out);
    const t2 = second.nodes[0];
    if (t2.kind !== 'text') throw new Error('expected text');
    expect(t2.stroke).toEqual(t.stroke);
    expect(t2.runs?.[1].stroke).toEqual(t.runs?.[1].stroke);
  });

  it('a gradient-stroked text node gets its gradient into <defs>', () => {
    // `<defs>` is written before the body, so a paint first seen while
    // emitting an element would reference an id nothing defines.
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 40,
      text: 'grad',
      stroke: {
        paint: {
          fill: 'linear-gradient',
          from: { x: 0, y: 0 },
          to: { x: 1, y: 0 },
          stops: [
            { offset: 0, color: '#ff0000' },
            { offset: 1, color: '#0000ff' },
          ],
        },
        width: 2,
      },
    };
    const out = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 40 } });
    const ref = /stroke="url\(#([^)]+)\)"/.exec(out);
    expect(ref).not.toBeNull();
    expect(out).toContain(`id="${ref![1]}"`);
  });

  it('unstroked text emits no stroke attribute at all', () => {
    const first = parseSvg(F.TEXT_PLAIN_SVG);
    const out = serializeSvg(first.nodes, { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(out).not.toContain('stroke=');
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

describe('letter-spacing / text-decoration', () => {
  it('serializes a run with letterSpacing + underline to letter-spacing="2" text-decoration="underline"', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'hi', letterSpacing: 2, underline: true }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('letter-spacing="2"');
    expect(svg).toContain('text-decoration="underline"');
  });

  it('parses a <tspan> letter-spacing + text-decoration="underline" back to run keys', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan letter-spacing="2" text-decoration="underline">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]).toMatchObject({ letterSpacing: 2, underline: true });
  });

  it('emits both flags as a space-separated list when a run has underline and strikethrough', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'hi', underline: true, strikethrough: true }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('text-decoration="underline line-through"');
  });

  it('round-trips text-decoration="underline line-through" on a <tspan> to both flags', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="underline line-through">hi</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]).toMatchObject({ underline: true, strikethrough: true });
  });

  it('text-decoration="none" maps to neither flag', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="none">hi</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.underline).toBeUndefined();
    expect(t.runs?.[0]?.strikethrough).toBeUndefined();
  });

  it('an unrecognized text-decoration token (e.g. blink) is dropped without crashing', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="blink">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.underline).toBeUndefined();
    expect(t.runs?.[0]?.strikethrough).toBeUndefined();
    expect(t.runs?.[0]?.overline).toBeUndefined();
  });

  it('serializes overline on a run and on the node style', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      style: { overline: true },
      runs: [{ text: 'hi', underline: true, overline: true }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('<text ');
    expect(svg).toContain('text-decoration="overline"');
    expect(svg).toContain('<tspan text-decoration="underline overline">hi</tspan>');
  });

  it('parses text-decoration="overline" to the overline flag at both levels', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0" text-decoration="overline"><tspan text-decoration="line-through overline">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.overline).toBe(true);
    expect(t.runs?.[0]).toMatchObject({ strikethrough: true, overline: true });
  });

  it('accepts letter-spacing with a unit suffix and drops the "normal" keyword', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan letter-spacing="2px">a</tspan><tspan letter-spacing="normal">b</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.letterSpacing).toBe(2);
    expect(t.runs?.[1]?.letterSpacing).toBeUndefined();
  });

  it('omits node-level letterSpacing when it is 0 (the default)', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      style: { letterSpacing: 0 },
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).not.toContain('letter-spacing');
  });

  it('emits run-level letterSpacing even when it is 0 — a real override, not "unset"', () => {
    // Per the runs model's additive-flags contract (rangeStyle.ts), a run
    // storing `letterSpacing: 0` is deliberately distinct from a run that
    // doesn't mention letterSpacing at all (which inherits the node's
    // value). Dropping it on serialize would silently turn the override
    // into an inherit, changing what the document renders.
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      style: { letterSpacing: 4 },
      runs: [{ text: 'hi', letterSpacing: 0 }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('letter-spacing="4"');
    expect(svg).toContain('<tspan letter-spacing="0">hi</tspan>');
  });

  it('is idempotent when a run overrides the node letterSpacing down to 0', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'AB',
      style: { letterSpacing: 4 },
      runs: [{ text: 'A' }, { text: 'B', letterSpacing: 0 }],
    };
    const svg1 = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    const parsed = parseSvg(svg1);
    const t = parsed.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.letterSpacing).toBe(4);
    // The override must survive as an explicit 0, not fall back to
    // "unset → inherits 4".
    expect(t.runs?.[1]?.letterSpacing).toBe(0);
    const svg2 = serializeSvg(parsed.nodes, { viewBox: parsed.viewBox });
    expect(svg2).toBe(svg1);
  });

  it('a run with only strikethrough (no other override) still attaches node.runs', () => {
    // hasStyling in parseTextElement decides whether the run array survives
    // parse at all — every other test here happens to set `underline`
    // alongside `strikethrough`, which would mask a hasStyling regression
    // that only checked one of the two flags.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="line-through">hi</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs).toBeDefined();
    expect(t.runs?.[0]).toMatchObject({ strikethrough: true });
    expect(t.runs?.[0]?.underline).toBeUndefined();
  });

  it('warns on a non-px letter-spacing unit (e.g. em) but still parses the numeric value', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan letter-spacing="0.1em">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.letterSpacing).toBe(0.1);
    expect(warnings.some((w) => /letter-spacing/.test(w) && /em/.test(w))).toBe(true);
  });

  it('matches text-decoration tokens case-insensitively', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="UNDERLINE">hi</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.underline).toBe(true);
  });
});

describe('baseline-shift / relative font-size', () => {
  const box = { x: 0, y: 0, width: 100, height: 20 };

  it('serializes script as SVG\'s own super/sub keywords', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'h', script: 'super' }, { text: 'i', script: 'sub' }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toContain('<tspan baseline-shift="super">h</tspan>');
    expect(svg).toContain('<tspan baseline-shift="sub">i</tspan>');
  });

  it('serializes baselineShift as a percentage of the parent font size', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'hi', baselineShift: 0.333 }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toContain('baseline-shift="33.3%"');
  });

  it('emits the raw baselineShift for a run that also names a script', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'hi', script: 'super', baselineShift: 0.5 }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toContain('baseline-shift="50%"');
    expect(svg).not.toContain('baseline-shift="super"');
    // The keyword carried the preset's size too, so with the keyword gone the
    // size has to be spelled out or the run comes back full-size.
    expect(svg).toContain('font-size="58.3%"');
  });

  it('serializes fontScale as a percentage font-size, and an absolute fontSize wins', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'h', fontScale: 0.583 }, { text: 'i', fontScale: 0.583, fontSize: 12 }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toContain('<tspan font-size="58.3%">h</tspan>');
    expect(svg).toContain('<tspan font-size="12">i</tspan>');
  });

  it('parses baseline-shift keywords, percentages and bare ems', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan baseline-shift="super">a</tspan><tspan baseline-shift="sub">b</tspan><tspan baseline-shift="33.3%">c</tspan><tspan baseline-shift="0.25">d</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]).toMatchObject({ script: 'super' });
    expect(t.runs?.[1]).toMatchObject({ script: 'sub' });
    expect(t.runs?.[2]?.baselineShift).toBeCloseTo(0.333, 6);
    expect(t.runs?.[3]?.baselineShift).toBe(0.25);
  });

  it('maps baseline-shift="baseline" and a zero shift to neither key', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan baseline-shift="baseline">a</tspan><tspan baseline-shift="0">b</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.script).toBeUndefined();
    expect(t.runs?.[0]?.baselineShift).toBeUndefined();
    expect(t.runs?.[1]?.baselineShift).toBeUndefined();
  });

  it('warns on a baseline-shift unit it cannot convert but still parses the number', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan baseline-shift="4px">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.baselineShift).toBe(4);
    expect(warnings.some((w) => /baseline-shift/.test(w) && /px/.test(w))).toBe(true);
  });

  it('parses a percentage font-size to fontScale and a length to fontSize', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan font-size="58.3%">a</tspan><tspan font-size="12px">b</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.fontScale).toBeCloseTo(0.583, 6);
    expect(t.runs?.[0]?.fontSize).toBeUndefined();
    expect(t.runs?.[1]?.fontSize).toBe(12);
    expect(t.runs?.[1]?.fontScale).toBeUndefined();
  });

  it('round-trips overline, script, baselineShift and fontScale through SVG', () => {
    const runs = [
      { text: 'a', overline: true },
      { text: 'b', script: 'super' as const },
      { text: 'c', baselineShift: 0.33, fontScale: 0.6 },
      // A half-overridden preset normalizes to the two primitives it stood
      // for — not field-identical, but the same rendering, which is all SVG
      // can carry here.
      { text: 'd', script: 'sub' as const, baselineShift: 0.5 },
    ];
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'abc',
      runs,
    };
    const svg1 = serializeSvg([node], { viewBox: box });
    const parsed = parseSvg(svg1);
    expect(parsed.warnings).toEqual([]);
    const t = parsed.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.slice(0, 3)).toEqual(runs.slice(0, 3));
    expect(t.runs?.[3]).toEqual({ text: 'd', baselineShift: 0.5, fontScale: 0.583 });
    expect(serializeSvg(parsed.nodes, { viewBox: parsed.viewBox })).toBe(svg1);
  });
});

describe('text direction', () => {
  const VIEW = { viewBox: { x: 0, y: 0, width: 200, height: 100 } };
  const ser = (style: Record<string, unknown>) => serializeSvg(
    [{ id: 't1', kind: 'text', x: 0, y: 0, width: 100, height: 20, text: 'AB', style }] as unknown as SvgNode[],
    VIEW,
  );

  it('writes direction="rtl" and keeps a reading-order start relative', () => {
    const out = ser({ align: 'start', direction: 'rtl' });
    expect(out).toContain('direction="rtl"');
    // SVG's text-anchor is reading-order relative too, so a reading-order
    // start stays `start` there rather than becoming the absolute edge.
    expect(out).not.toContain('text-anchor="end"');
  });

  it('anchors an absolute left at the far edge under rtl', () => {
    expect(ser({ align: 'left', direction: 'rtl' })).toContain('text-anchor="end"');
  });

  it('writes no direction for ltr', () => {
    expect(ser({ align: 'left' })).not.toContain('direction=');
  });

  it('round-trips an rtl alignment to the same rendered edge', () => {
    const out = ser({ align: 'start', direction: 'rtl' });
    const back = parseSvg(out).nodes[0] as { style?: Record<string, unknown> };
    expect(back.style?.direction).toBe('rtl');
    expect(resolveAlign(back.style?.align as never, 'rtl')).toBe('right');
  });
});
