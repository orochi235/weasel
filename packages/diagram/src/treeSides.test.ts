import { describe, expect, it } from 'vitest';
import { at, graphOf, type Box } from './layoutFixture';
import { tree } from './tree';

const BOXES: Readonly<Record<string, Box>> = { r: [0, 0], a: [0, 0], b: [0, 0], c: [0, 0], d: [0, 0], a1: [0, 0] };
const EDGES = [['r', 'a'], ['r', 'b'], ['r', 'c'], ['r', 'd'], ['a', 'a1']] as const;

const laid = (direction: 'right' | 'down') => {
  const result = tree(graphOf(BOXES, EDGES), { direction, treeSides: 'both' });
  return Object.fromEntries(Object.keys(BOXES).map((id) => [id, at(BOXES, result, id)]));
};

describe('tree with treeSides both', () => {
  it('puts the first children past the root and the rest before it, halves balanced by size', () => {
    const p = laid('right');
    expect(p.a!.x).toBeGreaterThan(p.r!.x);
    expect(p.b!.x).toBeGreaterThan(p.r!.x);
    expect(p.c!.x).toBeLessThan(p.r!.x);
    expect(p.d!.x).toBeLessThan(p.r!.x);
    expect(p.a1!.x).toBeGreaterThan(p.a!.x);
  });

  it('centers the root across each side', () => {
    const p = laid('down');
    expect(p.a!.y).toBeGreaterThan(p.r!.y);
    expect(p.c!.y).toBeLessThan(p.r!.y);
    expect(p.r!.x).toBeCloseTo((p.c!.x + p.d!.x) / 2);
  });

  it('lays out as one side when unset', () => {
    const result = tree(graphOf(BOXES, EDGES), { direction: 'right' });
    const r = at(BOXES, result, 'r');
    expect(['a', 'b', 'c', 'd'].every((id) => at(BOXES, result, id).x > r.x)).toBe(true);
  });
});
