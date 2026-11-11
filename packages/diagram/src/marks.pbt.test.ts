/**
 * A node's marks as specs. One spec per mark, each id its own; a text mark's `self` point sits on its node's `at`
 * point, moved by its offset, and derives back to where it was built; a drawn mark's path data, any text at all,
 * either builds or is refused with an error naming the node and the mark, never a `TypeError`.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { RectPose } from '@weasel-js/core';
import { anchorDerivePose } from './group';
import { diagramMarkOf, markSpecs, type DataMark } from './marks';
import { nonFinite, runs, tally, timeoutFor, gridCoord } from './pbt.fixture';
import { DEFAULT_NODE_STYLE } from './dataTypes';

const RUNS = 300;

const anchor = fc.record({ u: fc.double({ min: 0, max: 1, noNaN: true }), v: fc.double({ min: 0, max: 1, noNaN: true }) });
const textMark: fc.Arbitrary<DataMark> = fc.record({
  text: fc.string({ maxLength: 6 }),
  at: anchor,
  self: anchor,
  offset: fc.record({ x: gridCoord, y: gridCoord }),
  color: fc.constantFrom('red', '#123'),
}, { requiredKeys: ['text', 'at'] });
const D = fc.oneof(
  fc.constantFrom('M0 0 L1 1', 'M0 0 H1 V1 Z', 'M.5 0 A.5 .5 0 1 1 .5 1', 'M0 0 C0 1 1 1 1 0', 'M0 0', '', 'Z', 'M', 'L1 1', 'M0 0 Q1'),
  fc.string(),
  fc.array(fc.constantFrom('M', 'L', 'H', 'V', 'C', 'Q', 'A', 'Z', 'm', 'l', ' ', ',', '0', '1', '.5', '-', 'e', '1e400', 'NaN'), { maxLength: 12 }).map((xs) => xs.join('')),
);
const drawnMark: fc.Arbitrary<DataMark> = fc.record({
  d: D, fill: fc.constantFrom('red', '#123'), stroke: fc.constantFrom('blue'), strokeWidth: fc.nat(4), opacity: fc.double({ min: 0, max: 1, noNaN: true }),
}, { requiredKeys: ['d'] });

const box = fc.record({ x: gridCoord, y: gridCoord, width: fc.integer({ min: 0, max: 300 }), height: fc.integer({ min: 0, max: 200 }) });
const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const ctx = { style: DEFAULT_NODE_STYLE, textStyle: () => ({ fontFamily: 'sans-serif', fontSize: 12 }), measure };
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

describe('markSpecs', () => {
  it('pins each text mark\'s self point to its node\'s at point, where it derives to again', () => {
    const derive = anchorDerivePose<RectPose>();
    fc.assert(fc.property(fc.array(textMark, { maxLength: 4 }), box, (marks, b) => {
      const specs = markSpecs('n', marks, b, ctx);
      expect(specs.map((s) => s.id)).toEqual(marks.map((_, i) => `n/mark:${i}`));
      specs.forEach((spec, i) => {
        const mark = marks[i] as Extract<DataMark, { text: string }>;
        const pose = spec.pose as RectPose;
        expect(nonFinite(pose)).toEqual([]);
        const self = mark.self ?? mark.at;
        expect(near(pose.x + self.u * pose.width, b.x + mark.at.u * b.width + (mark.offset?.x ?? 0))).toBe(true);
        expect(near(pose.y + self.v * pose.height, b.y + mark.at.v * b.height + (mark.offset?.y ?? 0))).toBe(true);
        expect(spec.dependsOn).toEqual(['n']);
        const again = derive({ pose, data: spec.data }, [{ node: { data: {} }, pose: b }] as never)!;
        expect(near(again.x, pose.x) && near(again.y, pose.y)).toBe(true);
      });
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('builds a drawn mark or refuses its path data by node and mark, never with a TypeError', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(fc.oneof(drawnMark, textMark), { minLength: 1, maxLength: 3 }), box, (marks, b) => {
      let specs;
      try {
        specs = markSpecs('n', marks, b, ctx);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).not.toBeInstanceOf(TypeError);
        expect((e as Error).message).toMatch(/^diagramScene: node "n", mark \d+: path data /);
        seen.count('refused');
        return;
      }
      seen.count('built');
      specs.forEach((spec, i) => {
        const mark = marks[i]!;
        if (!('d' in mark)) return;
        expect(diagramMarkOf(spec)).toEqual({ d: mark.d });
        expect(spec.pose).toEqual(b);
        expect(spec.parent).toBe('n');
      });
    }), runs(RUNS));
    seen.atLeast('refused', RUNS / 10);
    seen.atLeast('built', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});

describe('diagramMarkOf', () => {
  it('reads a mark off any data without throwing, and only a string `d`', () => {
    fc.assert(fc.property(fc.anything(), fc.anything(), (data, mark) => {
      expect(diagramMarkOf({ data })).toSatisfy((m: unknown) => m === null || typeof (m as { d: unknown }).d === 'string');
      const wrapped = diagramMarkOf({ data: { diagram: { mark } } });
      expect(wrapped === null).toBe(!(mark !== null && typeof mark === 'object' && typeof (mark as { d?: unknown }).d === 'string'));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
