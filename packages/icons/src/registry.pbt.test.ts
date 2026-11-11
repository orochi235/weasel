/**
 * Stateful property tests of the icon registry against a model: tables added in batches and released,
 * overrides pushed and released, releases repeated, and rival owners refused, checking every ref's glyph,
 * each namespace's owner, the entries, and the version after every step; then variants provided, loaded,
 * and settled in any order against a model of their states.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createIconRegistry, IconNamespaceClaimedError, type IconRegistry } from './registry';
import type { IconRef } from './names';
import type { IconGlyph, IconTable } from './table';
import { glyph, runs, timeoutFor } from './pbt.fixture';

const NAMESPACES = ['core', 'ui', '__proto__', 'constructor'];
const NAMES = ['undo', 'redo', 'toString', '__proto__'];
const OWNERS = ['@a', '@b'];
const REFS = NAMESPACES.flatMap((ns) => NAMES.map((n) => `${ns}:${n}`));

/** A table built as JSON would hand it over, so `__proto__` is an own key. */
const table = (namespace: string, owner: string, icons: [string, IconGlyph][]): IconTable =>
  ({ namespace, owner, icons: Object.fromEntries(icons) });

interface ModelTable { id: number; t: IconTable }
interface ModelOverride { id: number; ref: string; glyph: IconGlyph; source: string }
interface Model {
  tables: ModelTable[];
  overrides: ModelOverride[];
}
interface Real {
  r: IconRegistry;
  adds: { ids: number[]; release: () => void }[];
  overrides: { id: number; release: () => void }[];
  next: number;
  heard: number;
}

const tally = new Map<string, number>();
const seen = (k: string) => tally.set(k, (tally.get(k) ?? 0) + 1);

const top = (m: Model, ref: string): { glyph: IconGlyph; owner: string; overridden: boolean } | undefined => {
  const over = m.overrides.filter((o) => o.ref === ref).at(-1);
  const layered = m.overrides.some((o) => o.ref === ref);
  if (over) return { glyph: over.glyph, owner: over.source, overridden: layered };
  const [ns, name] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  const t = m.tables.filter(({ t }) => t.namespace === ns && Object.hasOwn(t.icons, name)).at(-1);
  return t && { glyph: t.t.icons[name]!, owner: t.t.owner, overridden: false };
};

/** What a reader can see: every ref's glyph and owner, and every namespace's owner. */
function observe(r: IconRegistry): string {
  const refs = REFS.map((ref) => r.get(ref)?.body ?? '-');
  const owners = NAMESPACES.map((ns) => r.owner(ns) ?? '-');
  const entries = r.entries().map((e) => `${e.ref}=${e.glyph.body}/${e.owner}/${e.overridden}`).sort();
  return JSON.stringify([refs, owners, entries]);
}

function check(m: Model, real: Real, before: { version: number; seen: string; entries: readonly unknown[] }): void {
  const { r } = real;
  for (const ref of REFS) {
    const want = top(m, ref);
    expect(r.get(ref)).toBe(want?.glyph);
  }
  for (const ns of NAMESPACES) expect(r.owner(ns)).toBe(m.tables.find(({ t }) => t.namespace === ns)?.t.owner);
  const want = REFS.flatMap((ref) => {
    const t = top(m, ref);
    return t ? [{ ref, glyph: t.glyph, owner: t.owner, overridden: t.overridden }] : [];
  });
  const got = r.entries();
  expect([...got].sort((a, b) => a.ref.localeCompare(b.ref))).toEqual(want.sort((a, b) => a.ref.localeCompare(b.ref)));
  expect(r.entries()).toBe(got);
  const now = observe(r);
  if (now !== before.seen) expect(r.getVersion()).toBeGreaterThan(before.version);
  if (r.getVersion() === before.version) expect(got).toBe(before.entries);
  expect(real.heard).toBe(r.getVersion());
}

type Cmd = fc.Command<Model, Real>;
const snap = (r: IconRegistry) => ({ version: r.getVersion(), seen: observe(r), entries: r.entries() });

class Add implements Cmd {
  constructor(readonly batch: IconTable[]) {}
  check = () => true;
  run(m: Model, real: Real): void {
    const before = snap(real.r);
    const claims = new Map(m.tables.map(({ t }) => [t.namespace, t.owner]));
    let refused = false;
    for (const t of this.batch) {
      const held = claims.get(t.namespace);
      if (held !== undefined && held !== t.owner) refused = true;
      claims.set(t.namespace, held ?? t.owner);
    }
    if (refused) {
      seen('refused');
      expect(() => real.r.add(this.batch)).toThrow(IconNamespaceClaimedError);
      expect(real.r.getVersion()).toBe(before.version);
    } else {
      seen(this.batch.length === 0 ? 'add-empty' : 'add');
      const release = real.r.add(this.batch);
      const ids = this.batch.map((t) => {
        const id = real.next++;
        m.tables.push({ id, t });
        return id;
      });
      real.adds.push({ ids, release });
      if (this.batch.length === 0) expect(real.r.getVersion()).toBe(before.version);
    }
    check(m, real, before);
  }
  toString = () => `add(${JSON.stringify(this.batch)})`;
}

class ReleaseAdd implements Cmd {
  constructor(readonly pick: number, readonly twice: boolean) {}
  check = () => true;
  run(m: Model, real: Real): void {
    if (real.adds.length === 0) return;
    const at = this.pick % real.adds.length;
    const { ids, release } = real.adds[at]!;
    let before = snap(real.r);
    release();
    m.tables = m.tables.filter((t) => !ids.includes(t.id));
    seen('release');
    check(m, real, before);
    if (this.twice) {
      seen('release-again');
      before = snap(real.r);
      release();
      expect(real.r.getVersion()).toBe(before.version);
      check(m, real, before);
    }
    real.adds.splice(at, 1);
  }
  toString = () => `releaseAdd(${this.pick}, ${this.twice})`;
}

class Override implements Cmd {
  constructor(readonly ref: string, readonly body: string, readonly source: string | undefined) {}
  check = () => true;
  run(m: Model, real: Real): void {
    const before = snap(real.r);
    const g = glyph(this.body, 'Override');
    const release = real.r.override(this.ref as IconRef, g, this.source);
    const id = real.next++;
    m.overrides.push({ id, ref: this.ref, glyph: g, source: this.source ?? 'override' });
    real.overrides.push({ id, release });
    seen('override');
    check(m, real, before);
  }
  toString = () => `override(${this.ref}, ${this.body}, ${this.source})`;
}

class ReleaseOverride implements Cmd {
  constructor(readonly pick: number, readonly twice: boolean) {}
  check = () => true;
  run(m: Model, real: Real): void {
    if (real.overrides.length === 0) return;
    const at = this.pick % real.overrides.length;
    const { id, release } = real.overrides[at]!;
    let before = snap(real.r);
    release();
    m.overrides = m.overrides.filter((o) => o.id !== id);
    seen('release-override');
    check(m, real, before);
    if (this.twice) {
      before = snap(real.r);
      release();
      expect(real.r.getVersion()).toBe(before.version);
      check(m, real, before);
    }
    real.overrides.splice(at, 1);
  }
  toString = () => `releaseOverride(${this.pick}, ${this.twice})`;
}

const body = fc.constantFrom('a', 'b', 'c');
const tableArb = fc.record({
  namespace: fc.constantFrom(...NAMESPACES),
  owner: fc.constantFrom(...OWNERS),
  icons: fc.uniqueArray(fc.tuple(fc.constantFrom(...NAMES), body), { selector: ([n]) => n, maxLength: 3 }),
}).map(({ namespace, owner, icons }) => table(namespace, owner, icons.map(([n, b]) => [n, glyph(b)])));

const commands = fc.commands([
  fc.array(tableArb, { maxLength: 3 }).map((b) => new Add(b)),
  fc.tuple(fc.nat(), fc.boolean()).map(([p, t]) => new ReleaseAdd(p, t)),
  fc.tuple(fc.constantFrom(...REFS), body, fc.option(fc.constantFrom('app', 'theme'), { nil: undefined }))
    .map(([r, b, s]) => new Override(r, b, s)),
  fc.tuple(fc.nat(), fc.boolean()).map(([p, t]) => new ReleaseOverride(p, t)),
], { maxCommands: 30 });

describe('icon registry against a model', () => {
  it('resolves every ref, owner, and entry as the model does after every step', () => {
    tally.clear();
    fc.assert(fc.property(fc.array(tableArb, { maxLength: 2 }), commands, (seed, cmds) => {
      const m: Model = { tables: [], overrides: [] };
      const claims = new Map<string, string>();
      const initial = seed.filter((t) => {
        const held = claims.get(t.namespace);
        claims.set(t.namespace, held ?? t.owner);
        return held === undefined || held === t.owner;
      });
      const r = createIconRegistry(initial);
      const real: Real = { r, adds: [], overrides: [], next: 0, heard: r.getVersion() };
      r.subscribe(() => { real.heard++; });
      for (const t of initial) m.tables.push({ id: real.next++, t });
      fc.modelRun(() => ({ model: m, real }), cmds);
    }), runs(200));
    for (const k of ['add', 'add-empty', 'refused', 'release', 'release-again', 'override', 'release-override']) {
      expect(tally.get(k) ?? 0, k).toBeGreaterThan(20);
    }
  }, timeoutFor(200, 10));
});

describe('icon variants against a model', () => {
  type State = 'unknown' | 'idle' | 'loading' | 'loaded' | 'failed';
  const VARIANTS = ['all', 'picker', '__proto__'];

  it('moves each variant through its states as the model does, whatever order loads settle in', async () => {
    const seenStates = new Map<string, number>();
    const step = fc.oneof(
      { weight: 1, arbitrary: fc.record({ op: fc.constant('provide' as const), names: fc.subarray(VARIANTS) }) },
      { weight: 2, arbitrary: fc.record({ op: fc.constant('load' as const), name: fc.constantFrom(...VARIANTS) }) },
      {
        weight: 2,
        arbitrary: fc.record({
          op: fc.constant('settle' as const),
          name: fc.constantFrom(...VARIANTS),
          ok: fc.constantFrom(true, true, false),
          rival: fc.constantFrom(false, false, false, true),
        }),
      },
    );
    await fc.assert(fc.asyncProperty(fc.array(step, { minLength: 8, maxLength: 30 }), async (steps) => {
      const r = createIconRegistry([table('core', '@a', [['undo', glyph('u')]])]);
      const errors = console.error;
      console.error = () => {};
      try {
        const states = new Map<string, State>();
        const hasLoader = new Set<string>();
        const pending = new Map<string, { resolve: (ok: boolean, rival: boolean) => void }[]>();
        const flight = new Map<string, Promise<void>>();
        const added: string[] = [];
        const flush = () => new Promise<void>((res) => setTimeout(res, 0));
        for (const s of steps) {
          const before = r.getVersion();
          if (s.op === 'provide') {
            const loaders = Object.fromEntries(s.names.map((name) => [name, () => new Promise<{ default: IconTable[] }>((res, rej) => {
              const list = pending.get(name) ?? [];
              list.push({
                resolve: (ok, rival) => (ok
                  ? res({ default: [table(rival ? 'core' : `v-${name}`, rival ? '@b' : '@a', [[name, glyph(name)]])] })
                  : rej(new Error('offline'))),
              });
              pending.set(name, list);
            })]));
            const fresh = s.names.some((n) => !states.has(n));
            r.provideVariants(loaders);
            for (const n of s.names) {
              hasLoader.add(n);
              if (!states.has(n)) states.set(n, 'idle');
            }
            if (!fresh) expect(r.getVersion()).toBe(before);
          } else if (s.op === 'load') {
            const p = r.loadVariant(s.name);
            const state = states.get(s.name);
            if (!hasLoader.has(s.name) || state === 'loaded') {
              await p;
              expect(r.getVersion()).toBe(before);
            } else if (state === 'loading') {
              expect(p).toBe(flight.get(s.name));
            } else {
              states.set(s.name, 'loading');
              flight.set(s.name, p);
            }
            await flush();
          } else {
            const waiting = pending.get(s.name)?.shift();
            if (!waiting) continue;
            waiting.resolve(s.ok, s.rival);
            await flight.get(s.name);
            flight.delete(s.name);
            const ok = s.ok && !s.rival;
            states.set(s.name, ok ? 'loaded' : 'failed');
            if (ok) added.push(`v-${s.name}:${s.name}`);
            expect(r.get('core:undo')?.body).toBe('u');
            expect(r.owner('core')).toBe('@a');
          }
          for (const n of VARIANTS) {
            const want = states.get(n) ?? 'unknown';
            expect(r.variantState(n)).toBe(want);
            seenStates.set(want, (seenStates.get(want) ?? 0) + 1);
          }
          for (const ref of added) expect(r.get(ref)).toBeDefined();
        }
      } finally {
        console.error = errors;
      }
    }), runs(150));
    for (const s of ["unknown", "idle", "loading", "loaded", "failed"]) expect(seenStates.get(s) ?? 0, s).toBeGreaterThan(20);
  }, timeoutFor(150, 40));
});

describe('shrunk counterexamples', () => {
  it('changes nothing when an empty batch is added or released', () => {
    const r = createIconRegistry();
    const entries = r.entries();
    r.add([])();
    expect(r.getVersion()).toBe(0);
    expect(r.entries()).toBe(entries);
  });

  it('changes nothing when variants are provided that are already known, or none', () => {
    const r = createIconRegistry();
    r.provideVariants({});
    expect(r.getVersion()).toBe(0);
    r.provideVariants({ all: async () => ({ default: [] }) });
    const v = r.getVersion();
    r.provideVariants({ all: async () => ({ default: [] }) });
    expect(r.getVersion()).toBe(v);
  });
});
