/**
 * Stateful property test of `attachMenuDismiss` on a target that keys listeners the way the DOM does (type, listener,
 * and capture): random attaches with and without press dismissal and a blur guard, presses and wheels inside and
 * outside, blurs, resizes, and detaches, against a model. Every step checks how often each menu closed, and that a
 * detach takes away every listener its attach added, and only those.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { attachMenuDismiss, type MenuDismissTarget } from './dismiss';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

interface Ev { inside: boolean }
type Fn = (e: Ev) => void;
const captureOf = (o: boolean | { capture?: boolean } | undefined) => (typeof o === 'boolean' ? o : o?.capture ?? false);

function fakeTarget(): MenuDismissTarget<Ev> & { fire(type: string, e: Ev): void; count(): number } {
  const held: { type: string; fn: Fn; capture: boolean }[] = [];
  return {
    addEventListener(type, fn, o) {
      const capture = captureOf(o);
      if (!held.some((h) => h.type === type && h.fn === fn && h.capture === capture)) held.push({ type, fn, capture });
    },
    removeEventListener(type, fn, o) {
      const capture = captureOf(o);
      const i = held.findIndex((h) => h.type === type && h.fn === fn && h.capture === capture);
      if (i >= 0) held.splice(i, 1);
    },
    fire(type, e) { for (const h of held.filter((x) => x.type === type)) h.fn(e); },
    count: () => held.length,
  };
}

interface Menu { press: boolean; guard: boolean; keep: boolean; live: boolean; closes: number }
interface Model { menus: Menu[] }
interface Real { target: ReturnType<typeof fakeTarget>; closes: number[]; keep: boolean[]; detach: (() => void)[] }

const t = tally();

function check(m: Model, r: Real): void {
  expect(r.closes).toEqual(m.menus.map((x) => x.closes));
  expect(r.target.count()).toBe(m.menus.filter((x) => x.live).reduce((n, x) => n + (x.press ? 4 : 3), 0));
}

class Attach implements fc.Command<Model, Real> {
  constructor(readonly press: boolean | undefined, readonly guard: boolean) {}
  check = (m: Readonly<Model>): boolean => m.menus.length < 4;
  run(m: Model, r: Real): void {
    const i = m.menus.length;
    m.menus.push({ press: this.press ?? true, guard: this.guard, keep: false, live: true, closes: 0 });
    r.closes.push(0);
    r.keep.push(false);
    r.detach.push(attachMenuDismiss(r.target, {
      outside: (e) => !e.inside,
      close: () => { r.closes[i]!++; },
      ...(this.press === undefined ? {} : { press: this.press }),
      ...(this.guard ? { keepOnBlur: () => r.keep[i]! } : {}),
    }));
    check(m, r);
  }
  toString = (): string => `attach(press ${this.press}, guard ${this.guard})`;
}

class Fire implements fc.Command<Model, Real> {
  constructor(readonly type: 'pointerdown' | 'wheel' | 'blur' | 'resize', readonly inside: boolean) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    for (const x of m.menus) {
      if (!x.live) continue;
      const closes = this.type === 'pointerdown' ? x.press && !this.inside
        : this.type === 'wheel' ? !this.inside
          : this.type === 'blur' ? !(x.guard && x.keep) : true;
      if (closes) { x.closes++; t.count(`closed on ${this.type}`); }
      else t.count(`kept on ${this.type}`);
    }
    r.target.fire(this.type, { inside: this.inside });
    check(m, r);
  }
  toString = (): string => `${this.type}(${this.inside ? 'inside' : 'outside'})`;
}

class Keep implements fc.Command<Model, Real> {
  constructor(readonly at: number, readonly keep: boolean) {}
  check = (m: Readonly<Model>): boolean => m.menus.length > 0;
  run(m: Model, r: Real): void {
    const i = this.at % m.menus.length;
    m.menus[i]!.keep = this.keep;
    r.keep[i] = this.keep;
  }
  toString = (): string => `keepOnBlur(#${this.at}, ${this.keep})`;
}

class Detach implements fc.Command<Model, Real> {
  constructor(readonly at: number) {}
  check = (m: Readonly<Model>): boolean => m.menus.some((x) => x.live);
  run(m: Model, r: Real): void {
    const live = m.menus.map((x, i) => [x, i] as const).filter(([x]) => x.live);
    const [x, i] = live[this.at % live.length]!;
    x.live = false;
    r.detach[i]!();
    t.count('detached');
    check(m, r);
  }
  toString = (): string => `detach(#${this.at})`;
}

describe('attachMenuDismiss, against a model', () => {
  it('closes each attached menu on what should close it, and a detach removes exactly its listeners', () => {
    fc.assert(fc.property(fc.commands([
      fc.tuple(fc.option(fc.boolean(), { nil: undefined }), fc.boolean()).map(([p, g]) => new Attach(p, g)),
      fc.tuple(fc.constantFrom('pointerdown', 'wheel', 'blur', 'resize') as fc.Arbitrary<'pointerdown' | 'wheel' | 'blur' | 'resize'>, fc.boolean()).map(([ty, i]) => new Fire(ty, i)),
      fc.tuple(fc.nat(), fc.boolean()).map(([i, k]) => new Keep(i, k)),
      fc.tuple(fc.nat(), fc.boolean()).map(([i, k]) => new Keep(i, k)),
      fc.tuple(fc.constantFrom('pointerdown', 'wheel', 'blur') as fc.Arbitrary<'pointerdown' | 'wheel' | 'blur'>, fc.boolean()).map(([ty, i]) => new Fire(ty, i)),
      fc.nat().map((i) => new Detach(i)),
    ], { size: '+1', maxCommands: 30 }), (cmds) => {
      fc.modelRun(() => ({ model: { menus: [] }, real: { target: fakeTarget(), closes: [], keep: [], detach: [] } }), cmds);
    }), runs(RUNS));
    for (const ty of ['pointerdown', 'wheel', 'blur']) { t.atLeast(`closed on ${ty}`, RUNS / 10); t.atLeast(`kept on ${ty}`, RUNS / 30); }
    t.atLeast('closed on resize', RUNS / 10);
    t.atLeast('detached', RUNS / 3);
  }, timeoutFor(RUNS, 3));
});
