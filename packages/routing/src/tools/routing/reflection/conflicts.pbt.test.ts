/**
 * Property test of the route-conflict detector against the matcher it describes: two key bindings, each firing
 * its own action, are reported together exactly when some keystroke, on some platform and in some engagement
 * state, matches both at equal specificity, so that declaration order alone picks one.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { matchSpec, specificity, type KeySpec, type PhaseSpec } from '@weasel-js/gestures';
import type { Contribution } from '../../../contributions/types';
import { keyEvents, modSpec, runs, tally, timeoutFor } from '../../../pbt.fixture';
import { findConflicts } from './conflicts';

const KEYS = ['a', 'A', 'b', ['a', 'Enter'], 'Enter', '+'] as const;
const EVENT_KEYS = ['a', 'b', 'Enter', '+'];
const PHASES: (PhaseSpec | undefined)[] = [
  undefined, 'initial', 'engaged', '*',
  [{ channel: '*', phase: 'initial' }], [{ channel: '*', phase: '*' }],
  [{ channel: '&', phase: 'initial' }, { channel: '&', phase: 'engaged' }],
];

const keySpec: fc.Arbitrary<KeySpec> = fc.record({
  key: fc.constantFrom(...KEYS), mods: modSpec, phase: fc.constantFrom(...PHASES),
}).map(({ key, mods, phase }) => ({
  kind: 'key', key: typeof key === 'string' ? key : [...key],
  ...(mods !== undefined ? { mods } : {}), ...(phase !== undefined ? { phase } : {}),
}) as KeySpec);

interface Bound { owner: string; spec: KeySpec }

const entries = fc.array(fc.array(keySpec, { minLength: 1, maxLength: 2 }), { minLength: 1, maxLength: 3 })
  .map((owners) => owners.map((specs, i): Contribution<unknown> => ({
    id: `o${i}`,
    eligibility: { always: true },
    bindings: specs.map((spec, j) => ({ spec, actionId: `o${i}.act${j}` })),
  })));

/** Whether some keystroke fires both at the same rank. */
function tie(a: Bound, b: Bound): boolean {
  // The detector reads a phase as the canvas's, so the owners are engaged together or not at all.
  const engagedSets = [[], [...new Set([a.owner, b.owner])]];
  for (const isMac of [true, false]) {
    const same = specificity(a.spec, isMac).join() === specificity(b.spec, isMac).join();
    if (!same) continue;
    for (const engaged of engagedSets) {
      const channels = new Set(engaged);
      for (const key of EVENT_KEYS) {
        for (const e of keyEvents(key)) {
          const ev = { kind: 'key' as const, ...e };
          if (matchSpec(ev, a.spec, isMac, { selfChannel: a.owner, engagedChannels: channels })
            && matchSpec(ev, b.spec, isMac, { selfChannel: b.owner, engagedChannels: channels })) return true;
        }
      }
    }
  }
  return false;
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
          t.hit(want ? 'tie' : 'apart');
          // An owner with another tied pair is reported for that one; only a pair standing alone decides.
          const alone = bound.filter((x) => x.owner === a.owner || x.owner === b.owner).length === 2;
          if (alone) expect(got, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`).toBe(want);
          else if (want) expect(got).toBe(true);
        }
      }
    }), runs(400));
    t.expectHit('tie', 'apart');
  }, timeoutFor(400, 10));
});
