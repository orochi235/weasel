/**
 * Property tests of capability gating: `capabilitiesAllowed` is true exactly when every tag is allowed, an entry with
 * no tags is allowed everywhere, and a tool or contribution is eligible in the active mode exactly when each of its
 * tags is in the mode's `allows` or `IMPLICIT_TAGS`, through `eligibleForMode`, `eligibleTool`, and
 * `eligibleContribution` alike.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { capabilitiesAllowed, IMPLICIT_TAGS, isCapabilityTag, ALL_TAGS } from './capabilities';
import { eligibleContribution, eligibleTool } from './eligibility';
import { eligibleForMode } from './modeDefinition';
import { createModeRegistry } from './registry';
import { modes, runs, tag, tags, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;

describe('capabilitiesAllowed', () => {
  it('is true exactly when every tag is allowed, and for no tags at all', () => {
    const t = tally();
    fc.assert(fc.property(fc.uniqueArray(tag, { maxLength: 4 }), fc.option(tags, { nil: undefined }), (allowed, want) => {
      const got = capabilitiesAllowed(new Set(allowed), want);
      expect(got).toBe(want === undefined || want.every((x) => allowed.includes(x)));
      if (want !== undefined && want.length > 0) t.count(got ? 'allowed' : 'refused');
    }), runs(RUNS));
    t.atLeast('allowed', RUNS / 40);
    t.atLeast('refused', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});

describe('eligibility in the active mode', () => {
  it('admits an entry exactly when each of its tags is in allows or IMPLICIT_TAGS, by every reader', () => {
    const t = tally();
    fc.assert(fc.property(modes, fc.nat(), fc.option(tags, { nil: undefined }), (ms, pick, want) => {
      const mode = ms[pick % ms.length]!;
      const reg = createModeRegistry({ modes: ms, initial: mode.id });
      const expected = (want ?? []).every((x) => mode.allows.includes(x) || IMPLICIT_TAGS.includes(x));
      expect(eligibleForMode(mode, want ?? [])).toBe(expected);
      expect(eligibleTool(reg, { id: 't', ...(want ? { capabilities: want } : {}) })).toBe(expected);
      expect(eligibleContribution(reg, { id: 'c', ...(want ? { eligibility: { capabilities: want } } : {}) })).toBe(expected);
      expect(eligibleContribution(reg, { id: 'c', eligibility: {} })).toBe(true);
      t.count(expected ? 'eligible' : 'not');
    }), runs(RUNS));
    t.atLeast('eligible', RUNS / 5);
    t.atLeast('not', RUNS / 5);
  }, timeoutFor(RUNS, 1));

  it('reads a shipped tag as one, and any other string as not', () => {
    fc.assert(fc.property(fc.oneof(fc.constantFrom(...ALL_TAGS), tag, fc.string({ maxLength: 6 })), (s) => {
      expect(isCapabilityTag(s)).toBe((ALL_TAGS as readonly string[]).includes(s));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
