/**
 * Property tests of how one input's candidates are ranked: shuffling the bindings changes their order only among
 * candidates tied on every ranked step, where declaration order is the rule; the order holds tier, then
 * specificity; the contextual step lifts gated bindings only within such a tie; and the step `placedBy` names is
 * the one that tells two neighbors apart.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { specificity, type KeySpec, type PhaseSpec } from '@weasel-js/gestures';
import type { Action } from '../actions/action';
import { keyEvents, modSpec, runs, tally } from '../../pbt.fixture';
import { matchSorted, type BindingScope, type MatchResult, type ScopedBinding } from './matcher';
import { placedBy, preferContextual, preferViewScoped } from './ranking';

const SCOPES: BindingScope[] = ['hotkey', 'active', 'ambient'];
const PHASES: (PhaseSpec | undefined)[] = [undefined, 'initial', 'engaged', '*'];
const VIEWS = [undefined, [null], ['v'], [null, 'v']] as const;

const keySpec: fc.Arbitrary<KeySpec> = fc.record({
  key: fc.constantFrom('a', 'A', 'Enter', ['a', 'Enter']), phase: fc.constantFrom(...PHASES),
  // Mostly a few common spellings, so candidates often tie; now and then any spec at all.
  mods: fc.oneof({ weight: 3, arbitrary: fc.constantFrom(undefined, { alt: 'optional' as const }, { alt: true }) }, modSpec),
}).map(({ key, mods, phase }) => ({
  kind: 'key', key: typeof key === 'string' ? key : [...key],
  ...(mods !== undefined ? { mods } : {}), ...(phase !== undefined ? { phase } : {}),
}) as KeySpec);

const bindings = fc.array(fc.record({
  spec: keySpec, scope: fc.oneof({ weight: 3, arbitrary: fc.constant<BindingScope>('active') }, fc.constantFrom(...SCOPES)), gated: fc.boolean(),
  views: fc.oneof({ weight: 3, arbitrary: fc.constant(undefined) }, fc.constantFrom(...VIEWS)),
}), { minLength: 1, maxLength: 16 }).map((bs) => bs.map(({ spec, scope, views, gated }, i): ScopedBinding & { gated: boolean } => ({
  binding: { spec, actionId: `act${i}`, ...(views !== undefined ? { opts: { views: [...views] } } : {}) },
  scope, ownerId: null, gated,
})));

// Mostly no modifier or Alt alone, which the common specs above match.
const held = fc.oneof({ weight: 4, arbitrary: fc.constantFrom(0, 1) }, fc.nat(15));
const event = fc.tuple(fc.constantFrom('a', 'A', 'Enter'), held).map(([key, i]) => ({ kind: 'key' as const, ...keyEvents(key)[i]! }));
const rankOf = (m: MatchResult, isMac: boolean) => `${SCOPES.indexOf(m.scope)}|${specificity(m.binding.spec, isMac).join()}`;

describe('ranking', () => {
  it('orders matches by tier, then specificity, and moves only ties when the bindings are shuffled', () => {
    const t = tally();
    fc.assert(fc.property(
      bindings.chain((bs) => fc.tuple(fc.constant(bs), fc.shuffledSubarray(bs, { minLength: bs.length, maxLength: bs.length }))),
      event, fc.boolean(),
      ([bs, shuffled], e, isMac) => {
        const quiet = () => {};
        const a = matchSorted(e, bs, isMac, undefined, quiet);
        const b = matchSorted(e, shuffled, isMac, undefined, quiet);
        expect(b.map((m) => m.binding.actionId).sort()).toEqual(a.map((m) => m.binding.actionId).sort());
        expect(b.map((m) => rankOf(m, isMac))).toEqual(a.map((m) => rankOf(m, isMac)));
        for (let i = 1; i < a.length; i++) {
          const [p, c] = [a[i - 1]!, a[i]!];
          const tier = SCOPES.indexOf(p.scope) - SCOPES.indexOf(c.scope);
          expect(tier).toBeLessThanOrEqual(0);
          if (tier === 0) {
            const [sp, sc] = [specificity(p.binding.spec, isMac), specificity(c.binding.spec, isMac)];
            const k = sp.findIndex((v, j) => v !== sc[j]);
            if (k >= 0) expect(sp[k]).toBeGreaterThan(sc[k]!);
            else {
              t.hit('tie');
              // A tie keeps declaration order.
              expect(bs.findIndex((x) => x.binding === p.binding)).toBeLessThan(bs.findIndex((x) => x.binding === c.binding));
            }
          }
        }
      },
    ), runs(500));
    t.expectHit('tie');
  });

  it('lifts gated bindings only within a tie, and placedBy names the step that parts each pair', () => {
    const t = tally();
    fc.assert(fc.property(bindings, event, fc.boolean(), fc.constantFrom<string | null>(null, 'v'), (bs, e, isMac, view) => {
      const gated = new Set(bs.filter((b) => b.gated).map((b) => b.binding.actionId));
      const lookup = (id: string): Action | undefined =>
        ({ id, label: id, ...(gated.has(id) ? { eligible: { always: true } } : {}) }) as Action;
      const matched = preferViewScoped(matchSorted(e, bs, isMac, undefined, () => {}), view);
      const ranked = preferContextual(matched, lookup, () => true, view, isMac);
      expect(ranked.map((m) => m.binding.actionId).sort()).toEqual(matched.map((m) => m.binding.actionId).sort());
      const key = (m: MatchResult) => `${m.binding.opts?.views?.includes(view) ?? false}|${rankOf(m, isMac)}`;
      // The contextual step moves nothing out of its tie.
      expect(ranked.map(key)).toEqual(matched.map(key));
      for (let i = 1; i < ranked.length; i++) {
        const [p, c] = [ranked[i - 1]!, ranked[i]!];
        const contextual = gated.has(p.binding.actionId) && !gated.has(c.binding.actionId);
        const step = placedBy(p, c, view, contextual, isMac).step;
        if (key(p) === key(c)) {
          expect(gated.has(c.binding.actionId) && !gated.has(p.binding.actionId), 'an ungated binding above a gated one').toBe(false);
          expect(step).toBe(contextual ? 'context' : 'order');
          t.hit(step);
        } else {
          expect(['view', 'tier', 'specificity']).toContain(step);
          t.hit(step === 'specificity' && gated.has(c.binding.actionId) ? 'gated below a more specific one' : 'parted');
        }
      }
    }), runs(500));
    t.expectHit('context', 'order', 'parted', 'gated below a more specific one');
  });
});
