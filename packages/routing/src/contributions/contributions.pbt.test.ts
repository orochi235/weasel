/**
 * Property tests of contribution assembly: `mergeContributions` against a model, the order and state
 * `assembleEntries` builds, the tiers `scopeBindings` gives, and `withHeldModifier` against the matcher, on
 * both platforms.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { matchSpec, type KeySpec } from '@weasel-js/gestures';
import { keyEvents, modSpec, runs, tally, timeoutFor } from '../pbt.fixture';
import type { GestureBinding } from '../interactions/actions/binding';
import { assembleEntries, scopeBindings } from './assemble';
import { liveScope } from './eligibility';
import { heldModifierOf, withHeldModifier } from './heldModifier';
import { mergeContributions } from './merge';
import type { Contribution, Eligibility } from './types';

const IDS = ['a', 'b', 'c', 'd'];
const DEPS = ['scene', 'snap', 'grid'];

const eligibility: fc.Arbitrary<Eligibility> = fc.record({
  focus: fc.boolean(), always: fc.boolean(), claimed: fc.boolean(),
  offhand: fc.constantFrom('space', 'alt', 'ctrl', 'meta', 'shift', 'Shift', 'z'),
  capabilities: fc.subarray(['c1', 'c2']),
  keymap: fc.constantFrom<true | { unbound?: 'modal' | 'cascade' }>(true, { unbound: 'modal' }),
}, { requiredKeys: [] });

const keySpec: fc.Arbitrary<KeySpec> = fc.record({ key: fc.constantFrom('a', 'b'), mods: modSpec })
  .map(({ key, mods }) => ({ kind: 'key', key, ...(mods !== undefined ? { mods } : {}) }) as KeySpec);

const contribution: fc.Arbitrary<Contribution<unknown>> = fc.record({
  id: fc.constantFrom(...IDS),
  eligibility: fc.option(eligibility, { nil: undefined }),
  bindings: fc.array(keySpec.map((spec): GestureBinding => ({ spec, actionId: 'act' })), { maxLength: 2 }),
  deps: fc.option(fc.subarray(DEPS, { minLength: 1 }).map((ds) => Object.fromEntries(ds.map((d) => [d, () => d]))), { nil: undefined }),
}).map(({ eligibility: e, deps, ...rest }) => ({ ...rest, ...(e ? { eligibility: e } : {}), ...(deps ? { deps } : {}) }) as Contribution<unknown>);

describe('mergeContributions', () => {
  it('concatenates the bundles in order, and throws exactly when an id or a dep name repeats', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.array(contribution, { maxLength: 3 }), { maxLength: 3 }), (bundles) => {
      const flat = bundles.flat();
      const ids = flat.map((e) => e.id);
      const deps = flat.flatMap((e) => Object.keys(e.deps ?? {}));
      const clash = new Set(ids).size < ids.length || new Set(deps).size < deps.length;
      if (clash) { t.hit('throws'); expect(() => mergeContributions(...bundles)).toThrow(/mergeContributions/); }
      else { t.hit('merged'); expect(mergeContributions(...bundles)).toEqual(flat); }
    }), runs(300));
    t.expectHit('throws', 'merged');
  }, timeoutFor(300, 1));
});

const distinct = fc.uniqueArray(contribution, { selector: (e) => e.id, maxLength: 4 });
const inputs = fc.record({
  focusedId: fc.option(fc.constantFrom(...IDS), { nil: null }),
  hotkeyStack: fc.array(fc.constantFrom(...IDS, 'gone'), { maxLength: 4 }),
  allowedCapabilities: fc.option(fc.subarray(['c1', 'c2']).map((c) => new Set(c)), { nil: undefined }),
  openKeymap: fc.option(fc.constantFrom(...IDS, ''), { nil: undefined }),
});

describe('assembleEntries', () => {
  it('leads with the held entries, newest hold first, then the rest in order, each once', () => {
    const t = tally();
    fc.assert(fc.property(distinct, inputs, (entries, inp) => {
      const { ordered, state } = assembleEntries(entries, inp);
      const held = [...new Set([...inp.hotkeyStack].reverse())].flatMap((id) => entries.filter((e) => e.id === id));
      expect(ordered).toEqual([...held, ...entries.filter((e) => !held.includes(e))]);
      if (held.length > 1) t.hit('stacked');
      expect([...state.engagedIds ?? []].sort()).toEqual([...new Set(inp.hotkeyStack)].sort());
      expect(state.openKeymap).toBe(inp.openKeymap ? inp.openKeymap : undefined);
      expect(state.allows !== undefined).toBe(inp.allowedCapabilities !== undefined);
    }), runs(300));
    t.expectHit('stacked');
  }, timeoutFor(300, 1));
});

describe('scopeBindings', () => {
  it('tiers each live entry by its eligibility, held entries on the hotkey tier, a keymap only while open', () => {
    const t = tally();
    fc.assert(fc.property(distinct, inputs, (entries, inp) => {
      const { ordered, state } = assembleEntries(entries, inp);
      const got = scopeBindings(ordered, state);
      const want = ordered.flatMap((e) => {
        const el = e.eligibility ?? {};
        const caps = el.capabilities;
        let scope: 'hotkey' | 'active' | 'ambient' | null;
        if (caps && inp.allowedCapabilities && !caps.every((c) => inp.allowedCapabilities!.has(c))) scope = null;
        else if (el.keymap) scope = inp.openKeymap === e.id ? 'hotkey' : null;
        else if (inp.hotkeyStack.includes(e.id)) scope = 'hotkey';
        else if (el.focus && inp.focusedId === e.id) scope = 'active';
        else if (el.always || el.claimed) scope = 'ambient';
        else scope = null;
        expect(liveScope(e.id, el, state)).toBe(scope);
        if (scope === null) return [];
        t.hit(scope);
        return (e.bindings ?? []).map((b) => ({ scope, ownerId: e.id, actionId: b.actionId }));
      });
      expect(got.map((s) => ({ scope: s.scope, ownerId: s.ownerId, actionId: s.binding.actionId }))).toEqual(want);
      for (const s of got) {
        const entry = ordered.find((e) => e.id === s.ownerId)!;
        const held = s.scope === 'hotkey' ? heldModifierOf(entry.eligibility?.offhand) : null;
        const declared = entry.bindings!.find((b) => (held ? withHeldModifier(b, held) : b) === s.binding);
        expect(declared).toBeDefined();
      }
    }), runs(300));
    t.expectHit('hotkey', 'active', 'ambient');
  }, timeoutFor(300, 1));
});

describe('withHeldModifier', () => {
  const MODS = ['alt', 'ctrl', 'meta', 'shift'] as const;
  const field = { alt: 'altKey', ctrl: 'ctrlKey', meta: 'metaKey', shift: 'shiftKey' } as const;

  it('matches as the binding does with the modifier let go, unless the binding names it, on each platform', () => {
    const t = tally();
    fc.assert(fc.property(keySpec, fc.constantFrom(...MODS), (spec, m) => {
      const b: GestureBinding = { spec, actionId: 'act' };
      const held = withHeldModifier(b, m);
      expect(withHeldModifier(b, m)).toBe(held);
      const mods = spec.mods ?? {};
      for (const apple of [true, false]) {
        const modIsM = mods.mod !== undefined && m === (apple ? 'meta' : 'ctrl');
        const refusedByMod = mods.mod === false && (m === 'ctrl' || m === 'meta');
        const names = mods[m] !== undefined || modIsM || refusedByMod;
        t.hit(names ? 'names' : 'loosened');
        for (const e of keyEvents('a')) {
          const ev = { kind: 'key' as const, ...e };
          const as = names ? ev : { ...ev, [field[m]]: false };
          expect(matchSpec(ev, held.spec, apple), `${JSON.stringify(spec)} held on ${m}, ${JSON.stringify(e)}`).toBe(matchSpec(as, spec, apple));
        }
      }
    }), runs(300));
    t.expectHit('names', 'loosened');
  }, timeoutFor(300, 2));
});
