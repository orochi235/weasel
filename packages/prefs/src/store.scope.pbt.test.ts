/**
 * Stateful property test of split values in a store: selector writes and resets, plain writes, writes and reads
 * at a stated selection, whole-scope writes, and weighted reads of an open scope, a closed one, and one whose
 * default is split by a second selector, against a plain model of what each option holds. Every step checks each
 * leaf's value under every selection, the tree, and that subscribers heard every leaf whose value changed, with
 * the value it now reads.
 */
import fc from 'fast-check';
import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { PREF_ELSE } from './scope';
import { createPrefsStore, type PrefChange, type PrefsStore } from './store';

const MODES = ['a', 'b', 'c'] as const;
const SIZES = ['s', 'l'] as const;
type Mode = (typeof MODES)[number];
type Size = (typeof SIZES)[number];

const num = (d: number) => ({ kind: 'number', name: 'N', description: '', default: d, min: 0, max: 100 }) as const;
const SCHEMA = {
  name: 'S',
  children: {
    mode: { kind: 'enum', name: 'Mode', description: '', default: 'a', options: MODES.map((value) => ({ value, label: value })) },
    size: { kind: 'enum', name: 'Size', description: '', default: 's', options: SIZES.map((value) => ({ value, label: value })) },
    gap: { ...num(4), scopes: [{ selector: 'mode' }] },
    tint: { ...num(1), scopes: [{ selector: 'mode', overrides: ['b'] }] },
    pad: {
      ...num(2), scopes: [{ selector: 'mode' }, { selector: 'size' }],
      defaultScope: { $by: 'mode', $in: { b: { $by: 'size', $in: { l: 9 } } }, [PREF_ELSE]: 5 },
    },
  },
} satisfies PrefGroup;
type Split = 'gap' | 'tint' | 'pad';
const SPLIT: readonly Split[] = ['gap', 'tint', 'pad'];

/** What one split leaf holds: each mode's own value, the shared one, and, for `pad`, `b`'s own split by size. */
interface Held { own: Partial<Record<Mode, number>>; shared: number | undefined; bySize: Partial<Record<Size, number>> | undefined }
interface Model { mode: Mode; size: Size; held: Record<Split, Held> }

const fresh = (path: Split): Held => (path === 'pad' ? { own: {}, shared: 5, bySize: { l: 9 } } : { own: {}, shared: undefined, bySize: undefined });
const clamp = (v: number): number => Math.min(100, Math.max(0, v));
const DEFAULT: Record<Split, number> = { gap: 4, tint: 1, pad: 2 };

/** What `path` reads with the selectors at `mode` and `size`. */
function read(m: Model, path: Split, mode: Mode, size: Size): number {
  const h = m.held[path];
  const fallback = h.shared ?? DEFAULT[path];
  if (path === 'tint') return clamp(mode === 'b' ? h.own.b ?? fallback : fallback);
  if (path === 'pad' && mode === 'b' && h.bySize) return clamp(h.bySize[size] ?? DEFAULT.pad);
  return clamp(h.own[mode] ?? fallback);
}

function write(m: Model, path: Split, mode: Mode, size: Size, v: number): void {
  const h = m.held[path];
  if (path === 'tint' && mode !== 'b') h.shared = v;
  else if (path === 'pad' && mode === 'b' && h.bySize) h.bySize[size] = v;
  else h.own[mode] = v;
}

interface Real { store: PrefsStore<typeof SCHEMA>; heard: PrefChange[] }
type Cmd = fc.Command<Model, Real>;
const t = tally();

const anyMode = fc.constantFrom<Mode>(...MODES);
const anySize = fc.constantFrom<Size>(...SIZES);
const anySplit = fc.constantFrom<Split>(...SPLIT);
const value = fc.integer({ min: -20, max: 120 });

/** Run `act`, then check every leaf under every selection, the tree, and what subscribers heard. */
function step(m: Model, r: Real, act: () => void): void {
  const before = new Map(SPLIT.map((p) => [p, r.store.get(p)] as const));
  const was = { mode: r.store.get('mode'), size: r.store.get('size') };
  r.heard.length = 0;
  act();
  const heard = new Map(r.heard.map((c) => [c.path, c.value]));
  expect(r.store.get('mode')).toBe(m.mode);
  expect(r.store.get('size')).toBe(m.size);
  for (const [path, now] of [['mode', m.mode], ['size', m.size]] as const) {
    if (was[path] !== now) expect(heard.get(path)).toBe(now);
  }
  const tree = r.store.values();
  for (const path of SPLIT) {
    const now = read(m, path, m.mode, m.size);
    expect(r.store.get(path)).toBe(now);
    expect(tree[path]).toBe(now);
    if (before.get(path) !== now) {
      t.count('heard a change');
      expect(heard.has(path)).toBe(true);
    }
    if (heard.has(path)) expect(heard.get(path)).toBe(now);
    for (const mode of MODES) {
      for (const size of SIZES) expect(r.store.get(path, { at: { mode, size } })).toBe(read(m, path, mode, size));
    }
  }
}

class SetSelector implements Cmd {
  constructor(readonly which: 'mode' | 'size', readonly option: string) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    t.count('selector');
    if (this.which === 'mode') m.mode = (MODES as readonly string[]).includes(this.option) ? this.option as Mode : 'a';
    else m.size = this.option as Size;
    step(m, r, () => r.store.set(this.which, this.option as never));
  }
  toString = (): string => `set(${this.which}, ${this.option})`;
}

class Write implements Cmd {
  constructor(readonly path: Split, readonly v: number, readonly at: { mode?: Mode | 'zz'; size?: Size } | undefined) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    t.count(this.at ? 'write at' : 'write');
    const mode = this.at?.mode !== undefined && this.at.mode !== 'zz' ? this.at.mode : m.mode;
    const size = this.at?.size ?? m.size;
    write(m, this.path, mode, size, this.v);
    step(m, r, () => r.store.set(this.path, this.v, this.at ? { at: this.at } : undefined));
  }
  toString = (): string => `set(${this.path}, ${this.v}${this.at ? `, at ${JSON.stringify(this.at)}` : ''})`;
}

class WriteScope implements Cmd {
  constructor(readonly path: 'gap' | 'tint', readonly own: Partial<Record<Mode, number>>, readonly shared: number | undefined) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    t.count('whole scope');
    const own = this.path === 'tint' ? (this.own.b === undefined ? {} : { b: this.own.b }) : { ...this.own };
    m.held[this.path] = { own, shared: this.shared, bySize: undefined };
    const scope = { $by: 'mode', $in: { ...this.own }, ...(this.shared === undefined ? {} : { [PREF_ELSE]: this.shared }) };
    step(m, r, () => r.store.set(this.path, scope));
  }
  toString = (): string => `setScope(${this.path}, ${JSON.stringify(this.own)}, ${this.shared})`;
}

class Reset implements Cmd {
  constructor(readonly path: Split | 'mode' | 'size' | undefined) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    t.count('reset');
    for (const p of SPLIT) if (this.path === undefined || this.path === p) m.held[p] = fresh(p);
    if (this.path === undefined || this.path === 'mode') m.mode = 'a';
    if (this.path === undefined || this.path === 'size') m.size = 's';
    step(m, r, () => r.store.reset(this.path));
  }
  toString = (): string => `reset(${this.path ?? ''})`;
}

class Weigh implements Cmd {
  constructor(readonly path: Split, readonly wa: number, readonly wb: number, readonly wl: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    t.count('weigh');
    const modeW = { a: this.wa, b: this.wb };
    const sizeW = { s: 1, l: this.wl };
    const members: { v: number; w: number }[] = [];
    for (const [mode, wm] of Object.entries(modeW) as [Mode, number][]) {
      if (wm <= 0) continue;
      const bySize = this.path === 'pad' && mode === 'b' && m.held.pad.bySize;
      for (const [size, ws] of bySize ? (Object.entries(sizeW) as [Size, number][]) : [[m.size, 1] as const]) {
        if (ws > 0) members.push({ v: read(m, this.path, mode, size), w: wm * ws });
      }
    }
    // Ruled 2026-11-10: members weighing infinitely, an overflowed product among them, share the whole blend equally.
    const heaviest = members.some((x) => x.w === Infinity) ? members.filter((x) => x.w === Infinity).map((x) => ({ ...x, w: 1 })) : members;
    if (members.some((x) => x.w === Infinity)) t.count('infinite weight');
    const scale = Math.max(...heaviest.map((x) => x.w));
    const total = heaviest.reduce((n, x) => n + x.w / scale, 0);
    const got = r.store.get(this.path, { weights: { mode: modeW, size: sizeW } });
    expect(Number.isNaN(got)).toBe(false);
    if (heaviest.length === 0) expect(got).toBe(DEFAULT[this.path]);
    else expect(got).toBeCloseTo(heaviest.reduce((n, x) => n + x.v * (x.w / scale / total), 0), 9);
  }
  toString = (): string => `weigh(${this.path}, a ${this.wa}, b ${this.wb}, l ${this.wl})`;
}

const commands = fc.commands([
  fc.oneof(anyMode, fc.constant('zz')).map((o) => new SetSelector('mode', o)),
  anySize.map((o) => new SetSelector('size', o)),
  fc.tuple(anySplit, value).map(([p, v]) => new Write(p, v, undefined)),
  fc.tuple(anySplit, value, fc.option(fc.oneof(anyMode, fc.constant<'zz'>('zz')), { nil: undefined }), fc.option(anySize, { nil: undefined }))
    .map(([p, v, mode, size]) => new Write(p, v, { ...(mode ? { mode } : {}), ...(size ? { size } : {}) })),
  fc.tuple(fc.constantFrom<'gap' | 'tint'>('gap', 'tint'), fc.dictionary(anyMode, value, { maxKeys: 3 }), fc.option(value, { nil: undefined }))
    .map(([p, own, shared]) => new WriteScope(p, own, shared)),
  fc.constantFrom<Split | 'mode' | 'size' | undefined>(...SPLIT, 'mode', 'size', undefined).map((p) => new Reset(p)),
  fc.tuple(anySplit, fc.constantFrom(0, 1, 2, 0.5, 1e200, Infinity), fc.constantFrom(0, 1, 3, Infinity), fc.constantFrom(0, 1, 0.25, 1e200)).map(([p, a, b, l]) => new Weigh(p, a, b, l)),
], { maxCommands: 30 });

describe('split values in a store, against a model', () => {
  it('reads, writes, resets, and notifies as the model says', () => {
    fc.assert(
      fc.property(commands, (cmds) => {
        const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.' });
        const store = createPrefsStore(SCHEMA, cache);
        const real: Real = { store, heard: [] };
        store.subscribe((changes) => real.heard.push(...changes));
        const model: Model = { mode: 'a', size: 's', held: { gap: fresh('gap'), tint: fresh('tint'), pad: fresh('pad') } };
        fc.modelRun(() => ({ model, real }), cmds);
      }),
      runs(150),
    );
    for (const what of ['selector', 'write', 'write at', 'whole scope', 'reset', 'weigh']) t.atLeast(what, 30);
    t.atLeast('heard a change', 100);
    t.atLeast('infinite weight', 20);
  }, timeoutFor(150, 40));
});
