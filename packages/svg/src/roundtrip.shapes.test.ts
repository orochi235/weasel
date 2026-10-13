import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgNode } from './index';
import * as F from './__fixtures__/fixtures';
import { roundTrip } from './testing/roundTrip';

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
