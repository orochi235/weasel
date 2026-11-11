/**
 * Property test of the route-conflict detector against the matcher it describes: two key bindings, each firing
 * its own action, are reported together exactly when some keystroke, on some platform and in some engagement
 * state, matches both at equal specificity, so that declaration order alone picks one. Owners engage on their
 * own, and a keystroke names a key or a physical key `code`.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { matchSpec, specificity, type KeySpec, type PhaseSpec } from '@weasel-js/gestures';
import type { Contribution } from '../../../contributions/types';
import { keyEvents, modSpec, runs, tally, timeoutFor } from '../../../pbt.fixture';
import { findConflicts } from './conflicts';

const KEYS = ['a', 'A', 'b', ['a', 'Enter'], 'Enter', '+'] as const;
const EVENT_KEYS = ['a', 'b', 'Enter', '+'];
const CODES = ['KeyA', 'Enter', 'Digit1'];
/** What no spec's `key` names, so a keystroke typing it matches by `code` alone. Latin, so a chord typing it
 *  is not read as its code's letter (see `docs/unruled.md`). */
const UNNAMED = '~';
const PHASES: (PhaseSpec | undefined)[] = [
  undefined, 'initial', 'engaged', '*',
  [{ channel: '*', phase: 'initial' }], [{ channel: '*', phase: 'engaged' }], [{ channel: '*', phase: '*' }],
  [{ channel: '&', phase: 'initial' }, { channel: '&', phase: 'engaged' }],
  [{ channel: 'o0', phase: 'engaged' }], [{ channel: 'o1', phase: 'initial' }],
];

const keySpec: fc.Arbitrary<KeySpec> = fc.record({
  key: fc.constantFrom(...KEYS), mods: modSpec, phase: fc.constantFrom(...PHASES),
  code: fc.option(fc.oneof(fc.constantFrom(...CODES), fc.subarray(CODES, { minLength: 1 })), { nil: undefined, freq: 2 }),
}).map(({ key, mods, phase, code }) => ({
  kind: 'key', key: typeof key === 'string' ? key : [...key],
  ...(code !== undefined ? { code } : {}),
  ...(mods !== undefined ? { mods } : {}), ...(phase !== undefined ? { phase } : {}),
}) as KeySpec);

const subsets = <T>(xs: readonly T[]): T[][] => xs.reduce<T[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]);
const KEYSTROKES = [
  ...EVENT_KEYS.flatMap((key) => keyEvents(key)),
  ...CODES.flatMap((code) => keyEvents(UNNAMED).map((e) => ({ ...e, code }))),
];

interface Bound { owner: string; spec: KeySpec }

const entries = fc.array(fc.array(keySpec, { minLength: 1, maxLength: 2 }), { minLength: 1, maxLength: 3 })
  .map((owners) => owners.map((specs, i): Contribution<unknown> => ({
    id: `o${i}`,
    eligibility: { always: true },
    bindings: specs.map((spec, j) => ({ spec, actionId: `o${i}.act${j}` })),
  })));

/** Whether some keystroke fires both at the same rank. */
function tie(a: Bound, b: Bound): boolean {
  const engagedSets = subsets([...new Set([a.owner, b.owner, 'o0', 'o1', 'other'])]);
  for (const isMac of [true, false]) {
    const same = specificity(a.spec, isMac).join() === specificity(b.spec, isMac).join();
    if (!same) continue;
    for (const engaged of engagedSets) {
      const channels = new Set(engaged);
      for (const e of KEYSTROKES) {
        const ev = { kind: 'key' as const, ...e };
        if (matchSpec(ev, a.spec, isMac, { selfChannel: a.owner, engagedChannels: channels })
          && matchSpec(ev, b.spec, isMac, { selfChannel: b.owner, engagedChannels: channels })) return true;
      }
    }
  }
  return false;
}

const keysOf = (b: Bound) => [b.spec.key].flat().map((k) => k.toLowerCase());
const sharesKey = (a: Bound, b: Bound) => keysOf(a).some((k) => keysOf(b).includes(k));
/** Whether they tie with both owners engaged or both idle, which the detector once read as the only states. */
function tieOnKeysTogether(a: Bound, b: Bound): boolean {
  return [new Set<string>(), new Set([a.owner, b.owner])].some((channels) => KEYSTROKES.some((e) => [true, false].some((isMac) => {
    const ev = { kind: 'key' as const, ...e };
    return specificity(a.spec, isMac).join() === specificity(b.spec, isMac).join()
      && matchSpec(ev, a.spec, isMac, { selfChannel: a.owner, engagedChannels: channels })
      && matchSpec(ev, b.spec, isMac, { selfChannel: b.owner, engagedChannels: channels });
  })));
}

describe('findConflicts', () => {
  it('reports two bindings together exactly when one keystroke fires both at equal rank', () => {
    const t = tally();
    fc.assert(fc.property(entries, (es) => {
      const bound: Bound[] = es.flatMap((e) => (e.bindings ?? []).map((b) => ({ owner: e.id, spec: b.spec as KeySpec })));
      const conflicts = findConflicts(es);
      for (let i = 0; i < bound.length; i++) {
        for (let j = i + 1; j < bound.length; j++) {
          const a = bound[i]!;
          const b = bound[j]!;
          const want = tie(a, b);
          const got = conflicts.some((c) => (a.owner === b.owner
            ? c.ownerIds.filter((o) => o === a.owner).length >= 2
            : c.ownerIds.includes(a.owner) && c.ownerIds.includes(b.owner)));
          if (want) t.hit('tie');
          if (want && a.owner !== b.owner && !tieOnKeysTogether(a, b)) t.hit('tie apart');
          if (want && a.spec.code !== undefined && b.spec.code !== undefined && !sharesKey(a, b)) t.hit('tie by code');
          // A conflict names every member of a shared bucket that ties with another, so only a pair
          // standing alone says it does not tie.
          if (bound.length === 2) {
            if (!want) t.hit('apart alone');
            expect(got, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`).toBe(want);
          } else if (want) expect(got).toBe(true);
        }
      }
    }), runs(400));
    t.expectHit('tie', 'apart alone', 'tie apart', 'tie by code');
  }, timeoutFor(400, 10));
});
