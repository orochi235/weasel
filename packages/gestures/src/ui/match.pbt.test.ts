/**
 * Property tests of the matcher's pure parts: modifier matching swept over every modifier state, the phase
 * union, specificity's modifier count, and the key sugar's round trips through the route grammar.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ALL_MODIFIER_STATES, runs, timeoutFor } from '../pbt.fixture';
import type { PhaseAtom } from '../grammar/routeGrammar';
import type { EventModifiers } from './inputEvent';
import { bindingSpec, held, key, keySpecRoute } from './keySugar';
import { matchModifiers, matchPhase, matchSpec, type PhaseContext } from './match';
import { specificity } from './specificity';
import type { KeyHeldSpec, KeySpec, ModSpec } from './spec';

const RUNS = 300;

const MOD_KEYS = ['alt', 'ctrl', 'meta', 'mod', 'shift'] as const;
const value = fc.constantFrom<boolean | 'optional' | undefined>(undefined, true, false, 'optional');
const modSpec: fc.Arbitrary<ModSpec> = fc.tuple(...MOD_KEYS.map(() => value)).map((vs) => {
  const out: ModSpec = {};
  MOD_KEYS.forEach((k, i) => { if (vs[i] !== undefined) out[k] = vs[i]; });
  return out;
});

/** The modifier states `mods` accepts, as indexes into {@link ALL_MODIFIER_STATES}. */
const accepted = (mods: ModSpec | undefined, apple: boolean): number[] =>
  ALL_MODIFIER_STATES.flatMap((e, i) => (matchModifiers(e, mods, apple) ? [i] : []));

const FIELDS = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const;

describe('matchModifiers', () => {
  it('a spec naming exactly the held keys accepts that state alone', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 15 }), fc.boolean(), (i, apple) => {
      const e = ALL_MODIFIER_STATES[i]!;
      const exact: ModSpec = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey };
      expect(accepted(exact, apple)).toEqual([i]);
    }), runs(RUNS));
  });

  it('loosening any one key to optional accepts a superset', () => {
    fc.assert(fc.property(modSpec, fc.constantFrom(...MOD_KEYS), fc.boolean(), (mods, k, apple) => {
      const before = accepted(mods, apple);
      const after = new Set(accepted({ ...mods, [k]: 'optional' }, apple));
      for (const i of before) expect(after.has(i)).toBe(true);
    }), runs(RUNS));
  });

  it('accepts at least one state, and its own keys are independent: each is required, forbidden, or free', () => {
    fc.assert(fc.property(modSpec, fc.boolean(), (mods, apple) => {
      const ok = accepted(mods, apple).map((i) => ALL_MODIFIER_STATES[i]!);
      expect(ok.length).toBeGreaterThan(0);
      const free = FIELDS.filter((f) => ok.some((e) => e[f]) && ok.some((e) => !e[f])).length;
      expect(ok.length).toBe(2 ** free);
    }), runs(RUNS));
  });

  it('reads mod as meta on a Mac and as ctrl elsewhere', () => {
    fc.assert(fc.property(modSpec, fc.boolean(), (mods, apple) => {
      const { mod, ...rest } = mods;
      const own = apple ? 'meta' : 'ctrl';
      const strongest = [rest[own], mod].includes(true) ? true : [rest[own], mod].includes('optional') ? 'optional' : undefined;
      expect(accepted(mods, apple)).toEqual(accepted({ ...rest, [own]: strongest }, apple));
    }), runs(RUNS));
  });
});

describe('specificity', () => {
  it('counts the keys every state its modifiers accept holds', () => {
    fc.assert(fc.property(modSpec, fc.boolean(), (mods, apple) => {
      const ok = accepted(mods, apple).map((i) => ALL_MODIFIER_STATES[i]!);
      const always = FIELDS.filter((f) => ok.every((e: EventModifiers) => e[f])).length;
      expect(specificity({ kind: 'click', mods }, apple)[1]).toBe(always);
    }), runs(RUNS));
  });
});

describe('matchPhase', () => {
  const channel = fc.constantFrom('&', '*', 'rect', 'pen');
  const atom: fc.Arbitrary<PhaseAtom> = fc.record({ channel, phase: fc.constantFrom('initial', 'engaged', '*') });
  const ctx: fc.Arbitrary<PhaseContext> = fc.record({
    selfChannel: fc.constantFrom(null, 'rect', 'pen'),
    engagedChannels: fc.subarray(['rect', 'pen', 'hand']).map((ids) => new Set(ids)),
  });

  it('matches a list when any one of its atoms matches', () => {
    fc.assert(fc.property(fc.array(atom, { minLength: 1, maxLength: 4 }), ctx, (atoms, c) => {
      expect(matchPhase(atoms, c)).toBe(atoms.some((a) => matchPhase([a], c)));
    }), runs(RUNS));
  });

  // A named channel at any phase also matches every context, and ranks 1: open in docs/unruled.md.
  it('ranks an atom 0 exactly when it matches every context, and a list as its broadest atom', () => {
    const contexts = fc.sample(ctx, { numRuns: 64, seed: 1 });
    const unruled = (a: PhaseAtom): boolean => a.channel !== '&' && a.channel !== '*' && a.phase === '*';
    const rank = (atoms: PhaseAtom[]): number => specificity({ kind: 'click', phase: atoms })[2];
    fc.assert(fc.property(fc.array(atom, { minLength: 1, maxLength: 3 }), (atoms) => {
      for (const a of atoms.filter((x) => !unruled(x))) {
        expect(rank([a]) === 0, JSON.stringify(a)).toBe(contexts.every((c) => matchPhase([a], c)));
      }
      expect(rank(atoms)).toBe(Math.min(...atoms.map((a) => rank([a]))));
    }), runs(RUNS));
  });
});

describe('key sugar', () => {
  const keyName = fc.oneof(
    fc.constantFrom('a', 'Z', '?', ')', '(', ' ', '*', 'Escape', 'ArrowLeft', 'я', '=', '|'),
    fc.string({ unit: fc.constantFrom('a', 'Z', '1', ')', '(', '?', ' ', '*', '='), minLength: 1, maxLength: 4 }),
  );
  const atom: fc.Arbitrary<PhaseAtom> = fc.record({
    channel: fc.constantFrom('&', '*', 'rect'),
    phase: fc.constantFrom('initial' as const, 'engaged' as const, '*' as const),
  });
  const phase = fc.option(fc.oneof(fc.constantFrom('initial' as const, 'engaged' as const, '*' as const), fc.array(atom, { maxLength: 2 })), { nil: undefined });
  const keySpec: fc.Arbitrary<KeySpec | KeyHeldSpec> = fc.record({
    kind: fc.constantFrom('key' as const, 'keyHeld' as const),
    key: fc.oneof({ weight: 4, arbitrary: keyName }, { weight: 1, arbitrary: fc.array(keyName, { minLength: 1, maxLength: 2 }) }),
    code: fc.option(fc.constantFrom('KeyZ', 'Digit2'), { nil: undefined, freq: 4 }),
    mods: modSpec,
    phase,
  }, { requiredKeys: ['kind', 'key', 'mods'] }).map((s) => (Object.keys(s.mods).length > 0 ? s : { ...s, mods: undefined }));
  /** A phase spec as its atoms, as the matcher reads it. */
  const atomsOf = (p: KeySpec['phase']): readonly PhaseAtom[] =>
    p === undefined ? [{ channel: '*', phase: '*' }] : typeof p === 'string' ? [{ channel: '&', phase: p }] : p;

  it('writes a key spec as a route that reads back to a spec matching the same keystrokes, or as null', () => {
    let spelled = 0;
    let refused = 0;
    fc.assert(fc.property(keySpec, fc.boolean(), (spec, apple) => {
      const route = keySpecRoute(spec);
      const one = [spec.key].flat().length === 1;
      if (spec.code !== undefined || !one || (Array.isArray(spec.phase) && spec.phase.length === 0)) {
        expect(route).toBeNull();
        return;
      }
      if (route === null) { refused++; return; }
      spelled++;
      const back = bindingSpec(route);
      expect(back).toMatchObject({ kind: spec.kind, key: [spec.key].flat()[0] });
      expect(atomsOf(back!.phase)).toEqual(atomsOf(spec.phase));
      const press = (e: EventModifiers) => ({ kind: spec.kind, key: [spec.key].flat()[0]!, phase: 'down' as const, ...e });
      for (const e of ALL_MODIFIER_STATES) {
        expect(matchSpec(press(e), back!, apple), JSON.stringify(e)).toBe(matchSpec(press(e), spec, apple));
      }
    }), runs(RUNS));
    expect(spelled).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  }, timeoutFor(RUNS, 2));

  it('reads a shortcut with modifiers in any spelling, order, and case', () => {
    const alias = fc.constantFrom(
      ['Meta', 'meta'], ['cmd', 'meta'], ['COMMAND', 'meta'], ['Ctrl', 'ctrl'], ['control', 'ctrl'], ['Alt', 'alt'],
      ['option', 'alt'], ['Shift', 'shift'], ['MOD', 'mod'],
    );
    const k = fc.constantFrom('a', 'K', '+', '?', 'Space', 'esc', 'ArrowUp', '1');
    fc.assert(fc.property(fc.array(alias, { maxLength: 4 }), k, fc.boolean(), (names, last, isHeld) => {
      const shortcut = [...names.map(([n]) => n), last].join('+');
      const spec = isHeld ? held(shortcut) : key(shortcut);
      const want = Object.fromEntries(names.map(([, m]) => [m, true]));
      expect(spec.mods ?? {}).toEqual(want);
      expect(spec.key).toBe(last === 'Space' ? ' ' : last === 'esc' ? 'Escape' : last);
    }), runs(RUNS));
  });
});
