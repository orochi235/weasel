/**
 * Stateful property test of `createReflectable`: long random runs of pushes, sets, releases (by handle and by a
 * registrant a reflection reported, against its own key and another, live, shadowed, and already gone), deletes,
 * clears, and bumps, over keys named like `Object.prototype` members, with listeners that write back into the store
 * mid-notify. Every step checks lookups, the entries a reflection lists (order, values, sources, what each shadows,
 * which registrant object is live), that a snapshot is the same frozen array until the next change, the version,
 * and how many times listeners heard.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createReflectable, type Reflectable, type Registrant } from './reflectable';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;
const KEYS = ['a', 'b', '__proto__', 'constructor', 'toString', ''] as const;
type Key = (typeof KEYS)[number];

type Op =
  | { kind: 'push'; key: Key; value: number; source?: string }
  | { kind: 'set'; key: Key; value: number; source?: string }
  | { kind: 'releaseHandle'; handle: number }
  | { kind: 'release'; reg: number; other: Key | null }
  | { kind: 'delete'; key: Key }
  | { kind: 'clear' }
  | { kind: 'bump' }
  | { kind: 'listen'; echo: boolean }
  | { kind: 'unlisten'; which: number };

/** One registrant as the model knows it: its number, and what it holds. */
interface Reg { id: number; value: number; source: string | undefined }

interface Model {
  stacks: Map<Key, Reg[]>;
  /** Every registrant made, by id: the key it was made under. */
  made: { key: Key }[];
  /** Each push's release: the registrant it releases. */
  handles: number[];
  version: number;
  /** Listeners on: how many, and whether each writes back on hearing. */
  listening: { echo: boolean; live: boolean }[];
  heard: number;
}

interface Real {
  r: Reflectable<number>;
  /** Registrant objects by model id, as the reflection reported them. */
  objects: Registrant<number>[];
  releases: (() => void)[];
  offs: (() => void)[];
  heard: number;
  /** Set while a listener echoes, so its own write does not echo again. */
  echoing: boolean;
}

const t = tally();
const key = fc.constantFrom(...KEYS);
const source = fc.constantFrom(undefined, 'kit', 'app');
const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 5, arbitrary: fc.record({ kind: fc.constant('push' as const), key, value: fc.integer({ min: 0, max: 9 }), source }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('set' as const), key, value: fc.integer({ min: 0, max: 9 }), source }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('releaseHandle' as const), handle: fc.nat(40) }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('release' as const), reg: fc.nat(60), other: fc.oneof({ weight: 3, arbitrary: fc.constant(null) }, { weight: 1, arbitrary: key }) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('delete' as const), key }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'clear' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'bump' as const }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('listen' as const), echo: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('unlisten' as const), which: fc.nat(5) }) },
);

/** Count one change: the version moves and each listener on hears it, an echoing one writing `'echo'` once. */
function changed(m: Model, echoing = false): void {
  m.version++;
  for (const l of [...m.listening]) {
    if (!l.live) continue;
    m.heard++;
    if (l.echo && !echoing) {
      // The echo sets 'echo' over `a`'s live value: one more change, heard by everyone again.
      setModel(m, 'a', -1, 'echo', true);
    }
  }
}

function setModel(m: Model, k: Key, value: number, src: string | undefined, echoing = false): void {
  const reg = { id: m.made.length, value, source: src };
  m.made.push({ key: k });
  const stack = m.stacks.get(k);
  if (stack) stack[stack.length - 1] = reg;
  else m.stacks.set(k, [reg]);
  changed(m, echoing);
}

function releaseModel(m: Model, k: Key, id: number): boolean {
  const stack = m.stacks.get(k);
  const i = stack ? stack.findIndex((x) => x.id === id) : -1;
  if (i < 0) return false;
  stack!.splice(i, 1);
  if (stack!.length === 0) m.stacks.delete(k);
  changed(m);
  return true;
}

/** The registrant `op.reg` names among those made, or null before any is. */
const pickReg = (m: Model, n: number): number | null => (m.made.length === 0 ? null : n % m.made.length);

function apply(m: Model, real: Real, o: Op): void {
  const { r } = real;
  switch (o.kind) {
    case 'push': {
      const reg = { id: m.made.length, value: o.value, source: o.source };
      m.made.push({ key: o.key });
      const stack = m.stacks.get(o.key);
      if (stack) stack.push(reg);
      else m.stacks.set(o.key, [reg]);
      m.handles.push(reg.id);
      real.releases.push(r.push(o.key, o.value, o.source === undefined ? undefined : { source: o.source }));
      // Learn the registrant object before any echo moves `a`'s live one on.
      changed(m);
      t.count(m.stacks.get(o.key) && m.stacks.get(o.key)!.length > 1 ? 'push over' : 'push');
      return;
    }
    case 'set':
      setModel(m, o.key, o.value, o.source);
      r.set(o.key, o.value, o.source === undefined ? undefined : { source: o.source });
      t.count('set');
      return;
    case 'releaseHandle': {
      if (m.handles.length === 0) return;
      const h = o.handle % m.handles.length;
      const id = m.handles[h]!;
      const did = releaseModel(m, m.made[id]!.key, id);
      real.releases[h]!();
      t.count(did ? 'release by handle' : 'stale handle');
      return;
    }
    case 'release': {
      const id = pickReg(m, o.reg);
      if (id === null || real.objects[id] === undefined) return;
      const k = o.other ?? m.made[id]!.key;
      const expected = releaseModel(m, k, id);
      expect(r.release(k, real.objects[id]!)).toBe(expected);
      t.count(expected ? 'release reported' : k === m.made[id]!.key ? 'release gone' : 'release wrong key');
      return;
    }
    case 'delete': {
      const had = m.stacks.delete(o.key);
      if (had) changed(m);
      expect(r.delete(o.key)).toBe(had);
      t.count(had ? 'delete' : 'delete absent');
      return;
    }
    case 'clear': {
      const had = m.stacks.size > 0;
      m.stacks.clear();
      if (had) changed(m);
      r.clear();
      t.count(had ? 'clear' : 'clear empty');
      return;
    }
    case 'bump':
      changed(m);
      r.bump();
      return;
    case 'listen': {
      m.listening.push({ echo: o.echo, live: true });
      real.offs.push(r.subscribe(() => {
        real.heard++;
        if (o.echo && !real.echoing) {
          real.echoing = true;
          r.set('a', -1, { source: 'echo' });
          real.echoing = false;
        }
      }));
      return;
    }
    case 'unlisten': {
      if (m.listening.length === 0) return;
      const i = o.which % m.listening.length;
      m.listening[i]!.live = false;
      real.offs[i]!();
      t.count('unlisten');
    }
  }
}

/** Record the registrant objects the reflection now reports, under the model's ids. */
function learn(m: Model, real: Real): void {
  for (const e of real.r.entries()) {
    const stack = m.stacks.get(e.key as Key)!;
    [...e.shadowed, e.live].forEach((obj, i) => { real.objects[stack[i]!.id] ??= obj; });
  }
}

function check(m: Model, real: Real, before: { entries: readonly unknown[]; version: number }): void {
  const { r } = real;
  expect(r.getVersion()).toBe(m.version);
  expect(real.heard).toBe(m.heard);
  for (const k of KEYS) {
    const stack = m.stacks.get(k);
    expect(r.has(k)).toBe(stack !== undefined);
    expect(r.get(k)).toBe(stack?.at(-1)?.value);
  }
  const entries = r.entries();
  if (m.version === before.version) expect(entries).toBe(before.entries);
  expect(r.entries()).toBe(entries);
  expect(r.reflection.entries()).toBe(entries);
  expect(Object.isFrozen(entries)).toBe(true);
  expect(entries.map((e) => e.key)).toEqual([...m.stacks.keys()]);
  for (const e of entries) {
    const stack = m.stacks.get(e.key as Key)!;
    const live = stack.at(-1)!;
    expect(Object.isFrozen(e) && Object.isFrozen(e.shadowed)).toBe(true);
    expect([e.value, e.source]).toEqual([live.value, live.source]);
    expect([e.live.value, e.live.source]).toEqual([live.value, live.source]);
    expect(e.shadowed.map((s) => [s.value, s.source])).toEqual(stack.slice(0, -1).map((s) => [s.value, s.source]));
    [...e.shadowed, e.live].forEach((obj, i) => {
      const known = real.objects[stack[i]!.id];
      if (known !== undefined) expect(obj).toBe(known);
    });
  }
}

describe('createReflectable, against a model', () => {
  it('lists, looks up, versions, and notifies as the model says through long runs of writes', () => {
    fc.assert(fc.property(fc.array(op, { minLength: 1, maxLength: 80 }), (ops) => {
      const m: Model = { stacks: new Map(), made: [], handles: [], version: 0, listening: [], heard: 0 };
      const real: Real = { r: createReflectable<number>(), objects: [], releases: [], offs: [], heard: 0, echoing: false };
      for (const o of ops) {
        const before = { entries: real.r.entries(), version: real.r.getVersion() };
        apply(m, real, o);
        check(m, real, before);
        learn(m, real);
      }
      t.count(m.stacks.size > 2 ? 'many keys' : 'few keys');
    }), runs(RUNS));
    for (const what of ['push over', 'release by handle', 'stale handle', 'release reported', 'release gone', 'release wrong key', 'delete', 'clear', 'unlisten', 'many keys']) {
      t.atLeast(what, 10);
    }
  }, timeoutFor(RUNS, 30));
});
