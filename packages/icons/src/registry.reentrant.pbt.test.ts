/**
 * Stateful property tests of the icon registry with subscribers that act while it notifies: a listener armed
 * with an add, a release, or an override runs it inside the notice of whatever step came before, so changes
 * nest. Batches can hold a malformed table, which refuses the whole batch. Every ref, owner, and the entries are
 * checked against a model after each step, and what a listener reads mid-notice agrees with itself. Then a
 * listener that retries a failed variant from inside the failure's notice, against a count of loader failures.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createIconRegistry, IconNamespaceClaimedError, type IconRegistry } from './registry';
import type { IconRef } from './names';
import type { IconGlyph, IconTable } from './table';
import { glyph, runs, timeoutFor } from './pbt.fixture';

const NAMESPACES = ['core', '__proto__', 'toString', 'é'];
const NAMES = ['undo', 'constructor', '__proto__', '😀'];
const REFS = NAMESPACES.flatMap((ns) => NAMES.map((n) => `${ns}:${n}`));

type Act =
  | { op: 'add'; batch: IconTable[] }
  | { op: 'release'; pick: number }
  | { op: 'override'; ref: string; body: string; source: string | undefined }
  | { op: 'unoverride'; pick: number };

interface Model {
  tables: { id: number; t: IconTable }[];
  overrides: { id: number; ref: string; glyph: IconGlyph; source: string }[];
  adds: number[][];
  overs: number[];
  next: number;
}
interface Real {
  r: IconRegistry;
  adds: (() => void)[];
  overs: (() => void)[];
  armed: Act | undefined;
  heard: number;
  /** 1 while the step's own add or override has not returned its release yet: a listener cannot hold that one. */
  skip: number;
  /** Whether the reaction a listener ran threw, and what. */
  thrown: unknown;
}

const tally = new Map<string, number>();
const seen = (k: string) => tally.set(k, (tally.get(k) ?? 0) + 1);

const wellFormed = (t: IconTable): boolean =>
  typeof t.namespace === 'string' && typeof t.owner === 'string'
  && t.icons !== null && typeof t.icons === 'object' && !Array.isArray(t.icons);

/** Apply `act` to the model; what the registry should do: change and notify, do nothing, or throw. */
function model(m: Model, act: Act, glyphs: Map<string, IconGlyph>, skip = 0): 'notify' | 'none' | 'claimed' | 'malformed' {
  switch (act.op) {
    case 'add': {
      if (act.batch.length === 0) return 'none';
      if (!act.batch.every(wellFormed)) return 'malformed';
      const claims = new Map(m.tables.map(({ t }) => [t.namespace, t.owner]));
      for (const t of act.batch) {
        const held = claims.get(t.namespace);
        if (held !== undefined && held !== t.owner) return 'claimed';
        claims.set(t.namespace, t.owner);
      }
      m.adds.push(act.batch.map((t) => {
        m.tables.push({ id: m.next, t });
        return m.next++;
      }));
      return 'notify';
    }
    case 'release': {
      if (m.adds.length - skip <= 0) return 'none';
      const ids = m.adds.splice(act.pick % (m.adds.length - skip), 1)[0]!;
      m.tables = m.tables.filter((t) => !ids.includes(t.id));
      return 'notify';
    }
    case 'override': {
      m.overrides.push({ id: m.next, ref: act.ref, glyph: glyphs.get(act.body)!, source: act.source ?? 'override' });
      m.overs.push(m.next++);
      return 'notify';
    }
    case 'unoverride': {
      if (m.overs.length - skip <= 0) return 'none';
      const id = m.overs.splice(act.pick % (m.overs.length - skip), 1)[0]!;
      m.overrides = m.overrides.filter((o) => o.id !== id);
      return 'notify';
    }
  }
}

/** Do `act` to the registry, keeping its release functions in step with the model's lists. */
function perform(real: Real, act: Act, glyphs: Map<string, IconGlyph>, skip = 0): void {
  switch (act.op) {
    case 'add': {
      // Held first, so what a listener adds during this notice lands after it, as in the model.
      const slot = act.batch.length > 0 ? { release: () => {} } : undefined;
      if (slot) real.adds.push(() => slot.release());
      try {
        const release = real.r.add(act.batch);
        if (slot) slot.release = release;
      } catch (err) {
        if (slot) real.adds.pop();
        throw err;
      }
      return;
    }
    case 'release':
      if (real.adds.length - skip > 0) real.adds.splice(act.pick % (real.adds.length - skip), 1)[0]!();
      return;
    case 'override': {
      // Pushed first, so a listener releasing the newest override during this notice finds this one.
      const slot = { release: () => {} };
      real.overs.push(() => slot.release());
      slot.release = real.r.override(act.ref as IconRef, glyphs.get(act.body)!, act.source);
      return;
    }
    case 'unoverride':
      if (real.overs.length - skip > 0) real.overs.splice(act.pick % (real.overs.length - skip), 1)[0]!();
  }
}

function top(m: Model, ref: string) {
  const over = m.overrides.filter((o) => o.ref === ref).at(-1);
  if (over) return { glyph: over.glyph, owner: over.source, overridden: true };
  const i = ref.indexOf(':');
  const [ns, name] = [ref.slice(0, i), ref.slice(i + 1)];
  const t = m.tables.filter(({ t }) => t.namespace === ns && Object.hasOwn(t.icons, name)).at(-1);
  return t && { glyph: t.t.icons[name]!, owner: t.t.owner, overridden: false };
}

function check(m: Model, real: Real): void {
  for (const ref of REFS) expect(real.r.get(ref)).toBe(top(m, ref)?.glyph);
  for (const ns of NAMESPACES) expect(real.r.owner(ns)).toBe(m.tables.find(({ t }) => t.namespace === ns)?.t.owner);
  const want = REFS.flatMap((ref) => {
    const t = top(m, ref);
    return t ? [{ ref, ...t }] : [];
  });
  const byRef = (a: { ref: string }, b: { ref: string }) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);
  expect([...real.r.entries()].sort(byRef)).toEqual(want.sort(byRef));
  expect(real.heard).toBe(real.r.getVersion());
}

class Step implements fc.Command<Model, Real> {
  constructor(readonly act: Act, readonly reaction: Act | undefined, readonly glyphs: Map<string, IconGlyph>) {}
  check = () => true;
  run(m: Model, real: Real): void {
    real.armed = this.reaction;
    real.thrown = undefined;
    const pending = (op: Act['op']) => (this.act.op === 'add' && op === 'release') || (this.act.op === 'override' && op === 'unoverride') ? 1 : 0;
    real.skip = this.reaction ? pending(this.reaction.op) : 0;
    const want = model(m, this.act, this.glyphs);
    seen(`${this.act.op}:${want}`);
    if (want === 'claimed') expect(() => perform(real, this.act, this.glyphs)).toThrow(IconNamespaceClaimedError);
    else if (want === 'malformed') expect(() => perform(real, this.act, this.glyphs)).toThrow(TypeError);
    else perform(real, this.act, this.glyphs);
    if (want === 'notify' && this.reaction) {
      const reacted = model(m, this.reaction, this.glyphs, real.skip);
      seen(`reaction:${this.reaction.op}:${reacted}`);
      if (reacted === 'claimed') expect(real.thrown).toBeInstanceOf(IconNamespaceClaimedError);
      else if (reacted === 'malformed') expect(real.thrown).toBeInstanceOf(TypeError);
      else expect(real.thrown).toBeUndefined();
    } else {
      // Nothing notified, so the reaction never ran: it stays armed only until the next step re-arms.
      expect(real.thrown).toBeUndefined();
    }
    real.armed = undefined;
    check(m, real);
  }
  toString = () => `step(${JSON.stringify(this.act)}, ${JSON.stringify(this.reaction)})`;
}

const BODIES = ['a', 'b', 'c'];
const goodTable = fc.record({
  namespace: fc.constantFrom(...NAMESPACES),
  owner: fc.constantFrom('@a', '@b'),
  icons: fc.uniqueArray(fc.tuple(fc.constantFrom(...NAMES), fc.constantFrom(...BODIES)), { selector: ([n]) => n, maxLength: 3 }),
});
const badIcons = fc.constantFrom<unknown>(null, undefined, 'ab', 7, [glyph('arr')]);
const tableArb = (glyphs: Map<string, IconGlyph>): fc.Arbitrary<IconTable> => fc.oneof(
  { weight: 9, arbitrary: goodTable.map(({ namespace, owner, icons }) => {
    const out: Record<string, IconGlyph> = {};
    // Defined, as JSON.parse would, so `__proto__` is an own key.
    for (const [n, b] of icons) Object.defineProperty(out, n, { value: glyphs.get(b)!, enumerable: true, writable: true, configurable: true });
    return { namespace, owner, icons: out };
  }) },
  { weight: 1, arbitrary: fc.tuple(fc.constantFrom(...NAMESPACES), badIcons).map(([namespace, icons]) => ({ namespace, owner: '@a', icons } as unknown as IconTable)) },
);

function actArb(glyphs: Map<string, IconGlyph>): fc.Arbitrary<Act> {
  return fc.oneof(
    fc.array(tableArb(glyphs), { maxLength: 3 }).map((batch) => ({ op: 'add' as const, batch })),
    fc.nat().map((pick) => ({ op: 'release' as const, pick })),
    fc.record({
      op: fc.constant('override' as const), ref: fc.constantFrom(...REFS), body: fc.constantFrom(...BODIES),
      source: fc.option(fc.constantFrom('app', '__proto__'), { nil: undefined }),
    }),
    fc.nat().map((pick) => ({ op: 'unoverride' as const, pick })),
  );
}

describe('icon registry with listeners acting mid-notice', () => {
  it('resolves every ref, owner, and entry as the model does, through nested changes', () => {
    tally.clear();
    const glyphs = new Map(BODIES.map((b) => [b, glyph(b)]));
    const act = actArb(glyphs);
    const cmds = fc.commands([
      fc.tuple(act, fc.option(act, { nil: undefined, freq: 2 })).map(([a, re]) => new Step(a, re, glyphs)),
    ], { maxCommands: 60 });
    const errors = console.error;
    console.error = () => {};
    try {
      fc.assert(fc.property(cmds, (steps) => {
        const r = createIconRegistry();
        const real: Real = { r, adds: [], overs: [], armed: undefined, heard: 0, skip: 0, thrown: undefined };
        r.subscribe(() => { real.heard++; });
        r.subscribe(() => {
          // What a listener reads mid-notice agrees with itself.
          for (const e of r.entries()) expect(r.get(e.ref)).toBe(e.glyph);
          const act = real.armed;
          real.armed = undefined;
          if (!act) return;
          try {
            perform(real, act, glyphs, real.skip);
          } catch (err) {
            real.thrown = err;
          }
        });
        const m: Model = { tables: [], overrides: [], adds: [], overs: [], next: 0 };
        fc.modelRun(() => ({ model: m, real }), steps);
      }), runs(200));
    } finally {
      console.error = errors;
    }
    for (const k of ['add:notify', 'add:claimed', 'add:malformed', 'release:notify', 'override:notify', 'unoverride:notify',
      'reaction:add:notify', 'reaction:add:claimed', 'reaction:release:notify', 'reaction:override:notify', 'reaction:unoverride:notify']) {
      expect(tally.get(k) ?? 0, k).toBeGreaterThan(5);
    }
  }, timeoutFor(200, 20));
});

describe('a variant retried from its failure notice', () => {
  it('loads once the loader stops failing, retried by a listener as often as it is told', async () => {
    const errors = console.error;
    console.error = () => {};
    try {
      await fc.assert(fc.asyncProperty(fc.nat({ max: 4 }), fc.nat({ max: 4 }), fc.constantFrom('v', '__proto__', 'toString'),
        async (failures, retries, name) => {
          const r = createIconRegistry();
          let calls = 0;
          r.provideVariants({
            [name]: async () => {
              calls++;
              if (calls <= failures) throw new Error('offline');
              return { default: [{ namespace: 'v', owner: '@v', icons: { a: glyph('va') } }] };
            },
          });
          let left = retries;
          const runsOf: Promise<void>[] = [];
          r.subscribe(() => {
            if (r.variantState(name) === 'failed' && left-- > 0) runsOf.push(r.loadVariant(name));
          });
          await r.loadVariant(name);
          for (let i = 0; i < runsOf.length; i++) await runsOf[i];
          expect(calls).toBe(Math.min(failures, retries) + 1);
          expect(r.variantState(name)).toBe(failures <= retries ? 'loaded' : 'failed');
          expect(r.get('v:a')?.body).toBe(failures <= retries ? 'va' : undefined);
        }), runs(100));
    } finally {
      console.error = errors;
    }
  }, timeoutFor(100, 10));
});
