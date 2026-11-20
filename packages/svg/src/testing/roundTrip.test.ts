import { describe, it, expect } from 'vitest';
import type { SvgNode } from '../types';
import { normalizeAll } from './roundTrip';

const tri = (origin: { x: number; y: number } | undefined, coords: number[], extra: Partial<SvgNode> = {}): SvgNode => ({
  kind: 'path',
  path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1, 4]), coords: new Float32Array(coords), fillRule: 'nonzero', ...(origin ? { origin } : {}) },
  fill: { kind: 'solid', color: '#000' },
  ...extra,
} as SvgNode);

describe('normalizeAll', () => {
  it('compares a polygon in world coordinates, whatever its origin', () => {
    expect(normalizeAll([tri({ x: 10, y: 0 }, [0, 0, 5, 0, 0, 5])])).toEqual(normalizeAll([tri(undefined, [10, 0, 15, 0, 10, 5])]));
    expect(normalizeAll([tri({ x: 10, y: 0 }, [0, 0, 5, 0, 0, 5])])).not.toEqual(normalizeAll([tri(undefined, [0, 0, 5, 0, 0, 5])]));
  });

  it('tells apart nodes that differ in a field it does not lay out by name', () => {
    expect(normalizeAll([tri(undefined, [0, 0, 5, 0, 0, 5], { hidden: true })]))
      .not.toEqual(normalizeAll([tri(undefined, [0, 0, 5, 0, 0, 5])]));
    const image = (flipX?: true): SvgNode => ({ kind: 'image', href: 'a.png', x: 0, y: 0, width: 4, height: 4, ...(flipX ? { flipX } : {}) });
    expect(normalizeAll([image(true)])).not.toEqual(normalizeAll([image()]));
  });
});
