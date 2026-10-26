import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathFromD } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { markerHeads } from './markerHeads';

const INK = { kind: 'solid', color: '#000' } as const;
/** A symmetric chevron: its one interior vertex is also its arc-length midpoint. */
const CHEVRON = pathFromD('M0 22 L75 0 L150 22');

const midHead = (stroke: Stroke) => {
  const heads = markerHeads(CHEVRON, stroke, stroke.width as number, undefined);
  expect(heads).toHaveLength(1);
  return heads[0];
};

describe('markerHeads at an interior vertex', () => {
  it('puts a terminator head\'s leading edge on the vertex, trailing back along the bisector', () => {
    const b = boundsOfPath(midHead({ paint: INK, width: 3, markerMid: 'diamond' }).path);
    expect(b.x + b.width).toBeCloseTo(75, 4);
    expect(b.x).toBeCloseTo(75 - 4 * 3, 4);
    expect(b.y + b.height / 2).toBeCloseTo(0, 4);
  });

  it('centers the dot on the vertex', () => {
    const b = boundsOfPath(midHead({ paint: INK, width: 3, markerMid: 'dot' }).path);
    expect(b.x + b.width / 2).toBeCloseTo(75, 4);
    expect(b.y + b.height / 2).toBeCloseTo(0, 4);
  });
});
