import { describe, expect, it } from 'vitest';
import { pathToAnchors } from './anchors';
import { polygonFromPoints } from './builder';
import { smudgePath } from './smudgePath';

const square = () => polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
const anchors = (p: ReturnType<typeof square>) => pathToAnchors(p).anchors[0];

describe('smudgePath', () => {
  it('answers the path itself when nothing is under the brush', () => {
    const p = square();
    expect(smudgePath(p, { center: { x: 50, y: 50 }, delta: { x: 0, y: 10 }, radius: 10 })).toBe(p);
    expect(smudgePath(p, { center: { x: 50, y: 0 }, delta: { x: 0, y: 0 }, radius: 10 })).toBe(p);
  });

  it('adds anchors where a long edge passes under the brush, and moves them along the drag', () => {
    const out = anchors(smudgePath(square(), { center: { x: 50, y: 0 }, delta: { x: 0, y: -10 }, radius: 20 }));
    expect(out.length).toBeGreaterThan(4);
    const middle = out.find((a) => Math.abs(a.x - 50) < 1e-6);
    expect(middle?.y).toBeCloseTo(-10);
    // The corners are outside the brush and stay put.
    expect(out[0]).toMatchObject({ x: 0, y: 0 });
    expect(out.find((a) => a.x === 100 && a.y === 0)).toBeDefined();
  });

  it('bends the closing segment of a closed subpath too', () => {
    const out = anchors(smudgePath(square(), { center: { x: 0, y: 50 }, delta: { x: -10, y: 0 }, radius: 20 }));
    expect(out.length).toBeGreaterThan(4);
    expect(out.find((a) => Math.abs(a.y - 50) < 1e-6)?.x).toBeCloseTo(-10);
    expect(out.slice(0, 4)).toMatchObject([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
  });

  it('moves a point less the farther it is from the brush center, and scales by strength', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
    const push = (strength: number) => anchors(smudgePath(p, {
      center: { x: 0, y: 0 }, delta: { x: 0, y: 10 }, radius: 10, strength, detail: Infinity,
    }));
    const full = push(1);
    expect(full[0].y).toBeCloseTo(10);
    expect(full[1].y).toBeCloseTo(10 * (1 - 0.25) ** 2);
    expect(full[2].y).toBe(0);
    expect(push(0.5)[0].y).toBeCloseTo(5);
  });

  it('carries handles with their anchor, so a curve stays smooth', () => {
    const p = { kind: 'polygon' as const, fillRule: 'nonzero' as const,
      commands: new Uint8Array([0, 2, 2]), coords: new Float32Array([0, 0, 10, 0, 20, 10, 30, 10, 40, 10, 50, 0, 60, 0]) };
    const before = anchors(p)[1];
    const after = anchors(smudgePath(p, { center: { x: 30, y: 10 }, delta: { x: 0, y: 4 }, radius: 3, detail: Infinity }))[1];
    expect(after.y - before.y).toBeCloseTo(4);
    expect(after.inHandle!.y - before.inHandle!.y).toBeCloseTo(4);
    expect(after.outHandle!.y - before.outHandle!.y).toBeCloseTo(4);
  });
});
