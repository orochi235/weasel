import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import { computeBounds } from './serializeBounds';
import type { SvgPathNode, SvgStroke } from './types';

const INK = { kind: 'solid', color: '#000000' } as const;
const RECT = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).lineTo(0, 10).close().build();
const LINE = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();

function pathNode(path: SvgPathNode['path'], stroke: SvgStroke): SvgPathNode {
  return { kind: 'path', path, fill: { kind: 'none' }, stroke };
}

describe('computeBounds boxes the ink', () => {
  it('takes in the outer half of a stroke at the origin', () => {
    expect(computeBounds([pathNode(RECT, { paint: INK, width: 4, join: 'round' })]))
      .toEqual({ x: -2, y: -2, width: 14, height: 14 });
  });

  it('takes in the whole of an outer stroke, and none of an inner one', () => {
    expect(computeBounds([pathNode(RECT, { paint: INK, width: 2, join: 'round', align: 'outer' })]))
      .toEqual({ x: -2, y: -2, width: 14, height: 14 });
    expect(computeBounds([pathNode(RECT, { paint: INK, width: 2, align: 'inner' })]))
      .toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('takes in a marker head past the path', () => {
    const b = computeBounds([pathNode(LINE, { paint: INK, width: 1, markerEnd: { key: 'arrow', size: 4 } })]);
    expect(b.y).toBeLessThan(-1);
    expect(b.y + b.height).toBeGreaterThan(1);
  });

  it('leaves out an unpainted line but keeps its marker heads', () => {
    expect(computeBounds([pathNode(RECT, { paint: { kind: 'none' }, width: 4 })]))
      .toEqual({ x: 0, y: 0, width: 10, height: 10 });
    const b = computeBounds([pathNode(LINE, { paint: { kind: 'none' }, width: 1, markerEnd: { key: 'arrow', size: 4 } })]);
    expect(b.y).toBeLessThan(-1);
  });

  it('rotates the ink about the geometry center', () => {
    const node = { ...pathNode(RECT, { paint: INK, width: 4, join: 'round' }), rotation: Math.PI / 2 };
    const b = computeBounds([node]);
    expect(b.x).toBeCloseTo(-2);
    expect(b.y).toBeCloseTo(-2);
    expect(b.width).toBeCloseTo(14);
  });
});
