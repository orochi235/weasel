/**
 * Stateful test of a content stream through long runs of `q`, `Q`, `cm`, path operators, marks, and
 * rollbacks, against a model of the matrix stack: every coordinate reads back within 1e-4 of a page
 * unit through the matrices in force where it was written, every matrix entry within four decimals of
 * its axis, and after any rollback the stream is what the operators kept write afresh.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ContentStream } from './content';
import { latin1 } from './latin1';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { readContent } from './pdfReader.fixture';

const RUNS = 150;

type Op = { op: string; args: number[] };

interface Model {
  kept: Op[];
  /** The page units per unit where each kept operator was written. */
  scales: number[];
  marks: number[];
}

interface Real {
  out: ContentStream;
}

const stretch = (m: readonly number[]) => Math.max(Math.hypot(m[0]!, m[1]!), Math.hypot(m[2]!, m[3]!));

/** The scale in force after `ops`: each `cm` that stretches finitely multiplies it, `q` saves it, `Q` restores it. */
function scaleAfter(ops: readonly Op[]): number {
  let scale = 1;
  const saved: number[] = [];
  for (const { op, args } of ops) {
    if (op === 'q') saved.push(scale);
    else if (op === 'Q') scale = saved.pop() ?? scale;
    else if (op === 'cm') {
      const s = stretch(args);
      if (Number.isFinite(s) && s > 0) scale *= s;
    }
  }
  return scale;
}

function check(m: Model, r: Real): void {
  const read = readContent(r.out.bytes());
  expect(read.map((o) => o.op)).toEqual(m.kept.map((o) => o.op));
  read.forEach(({ args }, i) => {
    const { op, args: want } = m.kept[i]!;
    const scale = m.scales[i]!;
    want.forEach((x, j) => {
      const got = args[j] as number;
      const slack = Math.abs(x) * Number.EPSILON * 4;
      if (op === 'cm') {
        const axis = j < 2 ? Math.hypot(want[0]!, want[1]!) : j < 4 ? Math.hypot(want[2]!, want[3]!) : 0;
        if (j < 4) expect(Math.abs(got - x)).toBeLessThanOrEqual(0.5e-4 * Math.max(axis, 10 ** -100) + slack);
        else if (scale < 1e95) expect(Math.abs(got - x) * scale).toBeLessThanOrEqual(0.5e-4 + slack * scale);
      } else if (scale < 1e95) expect(Math.abs(got - x) * scale).toBeLessThanOrEqual(0.5e-4 + slack * scale);
    });
  });
}

const coordinate = fc.oneof(
  fc.double({ min: -1e4, max: 1e4, noNaN: true }),
  fc.double({ min: -1e-3, max: 1e-3, noNaN: true }),
  fc.double({ min: -1e12, max: 1e12, noNaN: true }),
);
const factor = fc.oneof(fc.double({ min: 0.1, max: 10, noNaN: true }), fc.constantFrom(1e-12, 1e-7, 1e-3, 0, 1e3, 1e7, 1e12, 1e150));

class Write implements fc.Command<Model, Real> {
  constructor(readonly o: Op) {}
  check = () => true;
  run(m: Model, r: Real): void {
    m.scales.push(scaleAfter(m.kept));
    m.kept.push(this.o);
    r.out.op(this.o.op, ...this.o.args);
    check(m, r);
  }
  toString = () => `${this.o.args.join(' ')} ${this.o.op}`;
}

class Mark implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    expect(r.out.mark()).toBe(m.kept.length);
    m.marks.push(m.kept.length);
  }
  toString = () => 'mark';
}

class Rollback implements fc.Command<Model, Real> {
  constructor(readonly pick: number) {}
  check = (m: Readonly<Model>) => m.marks.length > 0;
  run(m: Model, r: Real): void {
    const i = this.pick % m.marks.length;
    const at = m.marks[i]!;
    m.marks.length = i;
    m.kept.length = at;
    m.scales.length = at;
    r.out.rollback(at);
    check(m, r);
    const fresh = new ContentStream();
    for (const k of m.kept) fresh.op(k.op, ...k.args);
    expect(latin1(r.out.bytes())).toBe(latin1(fresh.bytes()));
  }
  toString = () => `rollback ${this.pick}`;
}

const commands = [
  fc.constantFrom('q', 'Q').map((op) => new Write({ op, args: [] })),
  // Uniform a quarter of the time, so a run of them scales far down as often as far up.
  fc.tuple(factor, fc.option(factor, { freq: 4 }), fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }), coordinate, coordinate)
    .map(([sx, other, a, e, f]) => {
      const sy = other ?? sx;
      return new Write({ op: 'cm', args: [Math.cos(a) * sx, Math.sin(a) * sx, -Math.sin(a) * sy, Math.cos(a) * sy, e, f] });
    }),
  fc.tuple(fc.constantFrom('m', 'l'), coordinate, coordinate).map(([op, x, y]) => new Write({ op, args: [x, y] })),
  fc.array(coordinate, { minLength: 4, maxLength: 4 }).map((args) => new Write({ op: 're', args })),
  fc.constant(new Mark()),
  fc.nat().map((n) => new Rollback(n)),
];

describe('a content stream, op by op', () => {
  it('writes every number finely enough for the matrices in force, through any run of saves, restores, and rollbacks', () => {
    const seen = tally();
    fc.assert(
      fc.property(fc.commands(commands, { maxCommands: 200, size: 'large' }), (cmds) => {
        const m: Model = { kept: [], scales: [], marks: [] };
        fc.modelRun(() => ({ model: m, real: { out: new ContentStream() } }), cmds);
        const top = Math.max(1, ...m.scales);
        const bottom = Math.min(1, ...m.scales);
        if (top > 1e6) seen.count('scaled up');
        if (bottom < 1e-6) seen.count('scaled down');
        if (m.kept.length > 50) seen.count('long');
      }),
      runs(RUNS),
    );
    for (const what of ['scaled up', 'scaled down', 'long']) seen.atLeast(what, 10);
  }, timeoutFor(RUNS, 50));
});
