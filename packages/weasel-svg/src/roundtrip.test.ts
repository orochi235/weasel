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

  it('nested groups with transforms', () => {
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
