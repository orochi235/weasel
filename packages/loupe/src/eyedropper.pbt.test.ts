/**
 * Stateful property test of the eyedropper over a sampler that answers at once, later, out of order, or with a
 * failure: hovers, leaves, picks, the answers settling in any order, and a dispose, against a model. `color` is the
 * latest hover's answer once it has come, never an earlier one's; `onColorChange` hears every change and nothing
 * else; a pick reports what it took unless that was nothing or the eyedropper is gone; and nothing is heard after
 * a dispose.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createEyedropperModel, type EyedropperModel } from './eyedropper';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

interface Pending { settle(): void; fail(): void; hex: string | null }
interface Model { color: string | null; latest: number; disposed: boolean; heard: (string | null)[]; picked: string[] }
interface Real {
  eye: EyedropperModel; pending: Pending[]; heard: (string | null)[]; picked: string[];
  /** What the next sample answers: a color or nothing, now or later. */
  next: { hex: string | null; later: boolean };
  /** Each hover's sequence number by its pending answer, so the model knows which one landed. */
  hoverOf: Map<Pending, number>;
}

const hex = fc.option(fc.constantFrom('#000000', '#ff0000', '#00ff00', '#ffffff'), { freq: 4 });
const seen = tally();

function heardTo(m: Model, h: string | null): void {
  if (m.disposed || h === m.color) return;
  m.color = h;
  m.heard.push(h);
}

function check(m: Model, r: Real): void {
  expect(r.eye.color).toBe(m.color);
  expect(r.heard).toEqual(m.heard);
  expect(r.picked).toEqual(m.picked);
}

const cmd = (label: string, run: (m: Model, r: Real) => void | Promise<void>, ...args: unknown[]): fc.AsyncCommand<Model, Real> => ({
  check: () => true,
  async run(m, r) { await run(m, r); seen.count(label); check(m, r); },
  toString: () => `${label}(${args.map((a) => JSON.stringify(a)).join(', ')})`,
});

const commands = [
  fc.tuple(hex, fc.boolean()).map(([h, later]) => cmd('hover', (m, r) => {
    r.next = { hex: h, later };
    const before = r.pending.length;
    r.eye.hover({ x: 1, y: 2 });
    if (m.disposed) return;
    m.latest++;
    if (r.pending.length > before) r.hoverOf.set(r.pending[r.pending.length - 1]!, m.latest);
    else heardTo(m, h);
  }, h, later)),
  fc.constant(cmd('leave', (m, r) => {
    r.eye.leave();
    if (m.disposed) return;
    m.latest++;
    heardTo(m, null);
  })),
  fc.tuple(hex, fc.boolean()).map(([h, later]) => cmd('pick', async (m, r) => {
    r.next = { hex: h, later };
    const before = r.pending.length;
    const got = r.eye.pick({ x: 3, y: 4 });
    if (m.disposed) { expect(got).toBeNull(); return; }
    if (r.pending.length > before) {
      const p = r.pending.pop()!;
      p.settle();
      expect(await got).toBe(h);
      seen.count('pick answered later');
    } else {
      expect(got).toBe(h);
    }
    if (h !== null && !m.disposed) m.picked.push(h);
  }, h, later)),
  fc.tuple(fc.nat(), fc.boolean()).map(([n, fails]) => cmd('answer', async (m, r) => {
    if (r.pending.length === 0) return;
    const p = r.pending.splice(n % r.pending.length, 1)[0]!;
    const mine = r.hoverOf.get(p);
    if (fails) p.fail(); else p.settle();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    if (mine !== undefined && mine === m.latest && !fails) heardTo(m, p.hex);
    seen.count(mine === m.latest ? 'latest answered' : 'stale answered');
  }, n, fails)),
  fc.constant(cmd('dispose', (m, r) => { r.eye.dispose(); m.disposed = true; })),
];

function setup(): { model: Model; real: Real } {
  const real = { pending: [], heard: [], picked: [], next: { hex: null, later: false }, hoverOf: new Map() } as unknown as Real;
  real.eye = createEyedropperModel({
    sample: () => {
      const { hex: h, later } = real.next;
      if (!later) return h;
      return new Promise<string | null>((resolve, reject) => {
        real.pending.push({ hex: h, settle: () => resolve(h), fail: () => reject(new Error('read failed')) });
      });
    },
    onColorChange: (h) => { real.heard.push(h); },
    onPick: (h) => { real.picked.push(h); },
  });
  return { model: { color: null, latest: 0, disposed: false, heard: [], picked: [] }, real };
}

describe('createEyedropperModel', () => {
  it('holds the latest hover\'s color through answers arriving in any order, failures, leaves, picks, and a dispose', async () => {
    await fc.assert(fc.asyncProperty(fc.commands(commands, { maxCommands: 40, size: 'large' }), async (cmds) => {
      await fc.asyncModelRun(setup, cmds);
    }), runs(RUNS));
    for (const what of ['hover', 'leave', 'pick', 'answer', 'dispose', 'stale answered', 'latest answered', 'pick answered later']) seen.atLeast(what, RUNS / 10);
  }, timeoutFor(RUNS, 30));
});
