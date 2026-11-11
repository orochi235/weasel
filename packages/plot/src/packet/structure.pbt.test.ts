/**
 * A packet's structural edits keep its fields whole, in bit order, and apart, each the width it was given, through
 * any run of inserts, removals, moves, and changes of width and start; and the packet always compiles finite.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compilePlot } from '../plotData';
import { measure, nonFinite, runs, tally, timeoutFor } from '../pbt.fixture';
import { PLOT_THEME } from '../theme';
import { insertPacketField, movePacketField, removePacketField, setPacketBits, setPacketStart } from './structure';
import type { PacketData } from './types';

const RUNS = 200;

type Op =
  | { op: 'insert'; at: number }
  | { op: 'remove'; at: number }
  | { op: 'move'; from: number; to: number }
  | { op: 'bits'; at: number; bits: number }
  | { op: 'start'; at: number; by: number };

const at = fc.oneof(fc.constant(0), fc.nat(1), fc.nat(3), fc.nat(6));
const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ op: fc.constant('insert' as const), at }) },
  fc.record({ op: fc.constant('remove' as const), at }),
  fc.record({ op: fc.constant('move' as const), from: at, to: at }),
  fc.record({ op: fc.constant('bits' as const), at, bits: fc.integer({ min: 1, max: 40 }) }),
  fc.record({ op: fc.constant('start' as const), at, by: fc.integer({ min: 0, max: 20 }) }),
);

describe('packet structure', () => {
  it('keeps every field whole, in order, apart, and as wide as it was made', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(op, { maxLength: 25, size: 'max' }), (ops) => {
      let data: PacketData = { kind: 'packet', fields: [] };
      const widths = new Map<string, number>();
      for (const o of ops) {
        const n = data.fields.length;
        if (o.op === 'insert' && o.at <= n) {
          data = insertPacketField(data, o.at);
          const added = data.fields[o.at]!;
          widths.set(added.label, added.end - added.start + 1);
        } else if (o.op === 'remove' && o.at < n) {
          widths.delete(data.fields[o.at]!.label);
          data = removePacketField(data, o.at);
        } else if (o.op === 'move' && o.from < n && o.to < n) {
          data = movePacketField(data, o.from, o.to);
        } else if (o.op === 'bits' && o.at < n) {
          data = setPacketBits(data, o.at, o.bits);
          widths.set(data.fields[o.at]!.label, o.bits);
        } else if (o.op === 'start' && o.at < n) {
          const floor = o.at === 0 ? 0 : data.fields[o.at - 1]!.end + 1;
          data = setPacketStart(data, o.at, floor + o.by);
          expect(data.fields[o.at]!.start).toBe(floor + o.by);
        } else continue;
        seen.count(o.op);
        expect(new Set(data.fields.map((f) => f.label)).size).toBe(data.fields.length);
        data.fields.forEach((f, i) => {
          expect(Number.isInteger(f.start) && Number.isInteger(f.end)).toBe(true);
          expect(f.start).toBeGreaterThanOrEqual(i === 0 ? 0 : data.fields[i - 1]!.end + 1);
          expect(f.end - f.start + 1).toBe(widths.get(f.label));
        });
        const marks = compilePlot(data, { width: 600, height: 400 }, PLOT_THEME, measure);
        expect(marks.flatMap((m) => nonFinite(m, m.key))).toEqual([]);
      }
    }), runs(RUNS));
    for (const name of ['insert', 'remove', 'move', 'bits', 'start']) seen.atLeast(name, RUNS / 4);
  }, timeoutFor(RUNS, 20));
});
