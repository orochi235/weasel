/**
 * Stateful property test of the keymap stack: random pushes, holds, releases, Escapes, inputs, swallows,
 * cascades, and closes, bare and inside raw inputs (`batch`, nested too), against a model of its levels. After
 * every step the open levels, the verdict, and the change notifications must agree with the model.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createKeymapStack, KEYMAP_HOLD, type KeymapStack, type KeymapVerdict } from './keymapStack';

interface MLevel { id: string; heldBy?: string; used: boolean; openedIn: number }

class Model {
  levels: MLevel[] = [];
  serial = 0;
  depth = 0;
  pending: (() => void)[] = [];
  verdict: KeymapVerdict = null;

  private later(op: () => void): void {
    if (this.depth > 0) this.pending.push(op);
    else op();
  }
  private popTapped(): void {
    while (this.levels.length > 0 && this.levels.at(-1)!.heldBy === undefined) this.levels.pop();
  }
  private settle = (): void => {
    if (this.depth > 0 && this.levels.some((l) => l.openedIn === this.serial)) return;
    for (const l of this.levels) if (l.heldBy !== undefined) l.used = true;
    this.popTapped();
  };

  push(id: string, heldBy?: string): void {
    const at = this.levels.findIndex((l) => l.id === id);
    if (at !== -1) this.levels.splice(at);
    this.levels.push({ id, ...(heldBy !== undefined ? { heldBy } : {}), used: false, openedIn: this.serial });
    if (this.depth > 0) this.verdict = 'taken';
  }
  holdOpened(heldBy: string): boolean {
    let held = false;
    for (const l of this.levels) {
      if (l.openedIn === this.serial && l.heldBy === undefined) { l.heldBy = heldBy; held = true; }
    }
    return held;
  }
  release(heldBy: string): void {
    const i = this.levels.findIndex((l) => l.heldBy === heldBy);
    if (i === -1) return;
    if (this.levels[i]!.used) {
      this.levels.splice(i);
      this.popTapped();
    } else delete this.levels[i]!.heldBy;
  }
  closeInnermost(): void {
    if (this.depth > 0) this.verdict = 'taken';
    this.later(() => { this.levels.pop(); });
  }
  inputSeen(): void {
    if (this.depth > 0) this.verdict ??= 'taken';
    this.later(this.settle);
  }
  cascaded(): void {
    if (this.depth > 0) this.verdict = 'cascaded';
    this.later(this.settle);
  }
  swallowed(): void {
    for (const l of this.levels) if (l.heldBy !== undefined) l.used = true;
  }
  closeAll(): void {
    this.pending = [];
    this.levels = [];
  }
  begin(): void {
    if (this.depth === 0) { this.serial++; this.verdict = null; }
    this.depth++;
  }
  end(): void {
    this.depth--;
    if (this.depth > 0) return;
    const ops = this.pending;
    this.pending = [];
    this.depth = 1;
    for (const op of ops) op();
    this.depth = 0;
    this.verdict = null;
  }
}

interface Real { s: KeymapStack; notified: number }

const IDS = ['a', 'b', 'c'];
const LEADERS = ['g1', 'g2', KEYMAP_HOLD];
const t = tally();

const shown = (m: Model) => m.levels.map((l) => ({ id: l.id, ...(l.heldBy !== undefined ? { heldBy: l.heldBy } : {}), usedWhileHeld: l.used }));

function check(m: Model, r: Real, before: { version: number; open: unknown }): void {
  const open = r.s.open().map(({ id, heldBy, usedWhileHeld }) => ({ id, ...(heldBy !== undefined ? { heldBy } : {}), usedWhileHeld }));
  expect(open).toEqual(shown(m));
  expect(r.s.innermost()).toBe(r.s.open().at(-1) ?? null);
  expect(new Set(open.map((l) => l.id)).size).toBe(open.length);
  if (m.depth > 0) expect(r.s.verdict()).toBe(m.verdict);
  else expect(r.s.verdict()).toBeNull();
  expect(r.notified).toBe(r.s.getVersion());
  if (JSON.stringify(before.open) !== JSON.stringify(open)) expect(r.s.getVersion()).toBeGreaterThan(before.version);
  if (open.length > 0) t.hit('open');
  if (open.some((l) => l.heldBy !== undefined && l.usedWhileHeld)) t.hit('used');
  if (open.length > 1) t.hit('stacked');
}

type Op = { name: string; model: (m: Model) => unknown; real: (s: KeymapStack) => unknown };

const opOver = (ids: readonly string[]): fc.Arbitrary<Op> => fc.oneof(
  fc.record({ id: fc.constantFrom(...ids), held: fc.option(fc.constantFrom(...LEADERS), { nil: undefined }) }).map(({ id, held }) => ({
    name: `push(${id}${held ? `, ${held}` : ''})`,
    model: (m: Model) => m.push(id, held),
    real: (s: KeymapStack) => s.push(id, id.toUpperCase(), held !== undefined ? { heldBy: held } : {}),
  })),
  fc.constantFrom(...LEADERS).map((g) => ({ name: `holdOpened(${g})`, model: (m: Model) => m.holdOpened(g), real: (s: KeymapStack) => s.holdOpened(g) })),
  fc.constantFrom(...LEADERS).map((g) => ({ name: `release(${g})`, model: (m: Model) => m.release(g), real: (s: KeymapStack) => s.release(g) })),
  ...(['closeInnermost', 'inputSeen', 'cascaded', 'swallowed', 'closeAll'] as const).map((name) => fc.constant<Op>({
    name: `${name}()`, model: (m) => m[name](), real: (s) => s[name](),
  })),
);

/** A step: one op bare, or a raw input holding several, maybe with an input nested inside it. */
const stepOver = (ids: readonly string[]) => {
  const op = opOver(ids);
  return fc.oneof(
    op.map((o) => ({ ops: [o], batch: false, nested: [] as Op[] })),
    fc.record({ ops: fc.array(op, { minLength: 1, maxLength: 4 }), batch: fc.constant(true), nested: fc.array(op, { maxLength: 2 }) }),
  );
};
type Step = { ops: Op[]; batch: boolean; nested: Op[] };

function play(steps: readonly Step[]): void {
  const m = new Model();
  const s = createKeymapStack();
  const r: Real = { s, notified: 0 };
  s.subscribe(() => { r.notified++; });
  for (const st of steps) {
    const before = { version: s.getVersion(), open: s.open().map(({ id, heldBy, usedWhileHeld }) => ({ id, ...(heldBy !== undefined ? { heldBy } : {}), usedWhileHeld })) };
    if (!st.batch) {
      const got = st.ops[0]!.real(s);
      expect(got).toEqual(st.ops[0]!.model(m));
      // Only a push restarts a level with nothing to show for it; anything else notifies on a change alone.
      const same = JSON.stringify(shown(m)) === JSON.stringify(before.open);
      if (same && !st.ops[0]!.name.startsWith('push')) expect(s.getVersion()).toBe(before.version);
    } else {
      m.begin();
      s.batch(() => {
        for (const o of st.ops) {
          expect(o.real(s)).toEqual(o.model(m));
          check(m, r, { version: -1, open: null });
        }
        if (st.nested.length > 0) {
          m.begin();
          s.batch(() => { for (const o of st.nested) expect(o.real(s)).toEqual(o.model(m)); });
          m.end();
        }
      });
      m.end();
    }
    check(m, r, before);
  }
}

describe('createKeymapStack', () => {
  it('keeps the levels, verdict, and notifications a model of the stack predicts', () => {
    fc.assert(fc.property(fc.array(stepOver(IDS), { maxLength: 25 }), play), runs(300));
    t.expectHit('open', 'used', 'stacked');
  }, timeoutFor(300, 5));

  it('keeps to the model through runs of up to 200 steps over ids named like Object.prototype members', () => {
    fc.assert(fc.property(fc.array(stepOver(['__proto__', 'toString', 'constructor', 'a']), { maxLength: 200 }), play), runs(60));
  }, timeoutFor(60, 40));
});
