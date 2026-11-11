/**
 * `selfLoop` on the sides of any box, in any order: it leaves by one side and returns by one across it, the same two
 * however the ports are listed, past a corner point `standoff` clear of both sides, and keeps an end it is given.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { gridCoord, runs, tally, timeoutFor } from './pbt.fixture';
import { selfLoop } from './selfLoop';
import type { Port } from './types';

const RUNS = 300;

const SIDES = {
  n: (b: Box) => ({ point: { x: b.x + b.width / 2, y: b.y }, normal: { x: 0, y: -1 } }),
  e: (b: Box) => ({ point: { x: b.x + b.width, y: b.y + b.height / 2 }, normal: { x: 1, y: 0 } }),
  s: (b: Box) => ({ point: { x: b.x + b.width / 2, y: b.y + b.height }, normal: { x: 0, y: 1 } }),
  w: (b: Box) => ({ point: { x: b.x, y: b.y + b.height / 2 }, normal: { x: -1, y: 0 } }),
};
interface Box { x: number; y: number; width: number; height: number }

const box = fc.record({ x: gridCoord, y: gridCoord, width: fc.integer({ min: 1, max: 200 }), height: fc.integer({ min: 1, max: 200 }) });
const sides = fc.shuffledSubarray(['n', 'e', 's', 'w'] as const, { minLength: 1 });
const standoff = fc.integer({ min: 0, max: 60 });

const portsOf = (b: Box, names: readonly (keyof typeof SIDES)[]): Port[] =>
  names.map((name) => ({ id: name, nodeId: 'n', ...SIDES[name](b) }));

const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;

describe('selfLoop', () => {
  it('leaves by one side and returns by one across it, past a corner clear of both, however the ports are listed', () => {
    const seen = tally();
    fc.assert(fc.property(box, sides, standoff, (b, names, s) => {
      const ports = portsOf(b, names);
      const loop = selfLoop(ports, s);
      const across = names.some((m) => names.some((k) => Math.abs(dot(SIDES[m](b).normal, SIDES[k](b).normal)) < 0.5));
      expect(loop === null).toBe(!across);
      if (loop === null) return;
      seen.count('looped');
      expect(Math.abs(dot(loop.from.normal!, loop.to.normal!))).toBeLessThan(0.5);
      expect(dot({ x: loop.via.x - loop.to.point.x, y: loop.via.y - loop.to.point.y }, loop.to.normal!)).toBeCloseTo(s, 9);
      expect(dot({ x: loop.via.x - loop.from.point.x, y: loop.via.y - loop.from.point.y }, loop.from.normal!)).toBeCloseTo(s, 9);
      if (names.includes('e') && names.includes('n')) expect([loop.from.id, loop.to.id]).toEqual(['e', 'n']);
      const again = selfLoop([...ports].reverse(), s)!;
      expect([again.from.id, again.to.id]).toEqual([loop.from.id, loop.to.id]);
    }), runs(RUNS));
    seen.atLeast('looped', RUNS / 2);
  }, timeoutFor(RUNS, 1));

  it('keeps the end it is given and takes the other across it', () => {
    const seen = tally();
    fc.assert(fc.property(box, sides, standoff, fc.nat(), fc.boolean(), (b, names, s, pick, asFrom) => {
      const ports = portsOf(b, names);
      const fixed = ports[pick % ports.length]!;
      const loop = selfLoop(ports, s, asFrom ? { from: fixed } : { to: fixed });
      const across = ports.some((p) => Math.abs(dot(p.normal!, fixed.normal!)) < 0.5);
      expect(loop === null).toBe(!across);
      if (loop === null) return;
      seen.count('looped');
      expect(asFrom ? loop.from : loop.to).toBe(fixed);
      expect(Math.abs(dot(loop.from.normal!, loop.to.normal!))).toBeLessThan(0.5);
    }), runs(RUNS));
    seen.atLeast('looped', RUNS / 2);
  }, timeoutFor(RUNS, 1));
});
