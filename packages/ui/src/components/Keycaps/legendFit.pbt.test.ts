/**
 * Property tests of how a keycap picks and sizes its legend: the spelling it picks is one it was offered and the
 * best by the stated order, scales stay in `minScale..1`, and a bank's single-line legends share one scale.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { key, runs, tally, timeoutFor, uniform } from '../../pbt.fixture';
import { clampScale, KEY_SPELLINGS, pickSpelling, resolveBankScales, spellingsOf } from './legendFit';

const RUNS = 400;
const scale = fc.oneof(uniform(0, 1.5), fc.constantFrom(0, 0.6, 1, 2));
const short = uniform(0, 0.99);
const fit = fc.record({ label: fc.string({ maxLength: 3 }), lines: fc.constantFrom(1, 1, 2), scale });

describe('spellingsOf', () => {
  it('gives the legend first, then its own alternates, for any legend, prototype names included', () => {
    fc.assert(fc.property(fc.oneof(key, fc.constantFrom(...Object.keys(KEY_SPELLINGS))), (label) => {
      const got = spellingsOf(label, KEY_SPELLINGS);
      expect(got[0]).toBe(label);
      expect(got.slice(1)).toEqual(Object.hasOwn(KEY_SPELLINGS, label) ? KEY_SPELLINGS[label] : []);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('pickSpelling', () => {
  it('picks an offered form: the first whole one, else the largest allowed two-line one at minScale or more, else the largest', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.oneof(fit, fc.record({ label: fc.string({ maxLength: 3 }), lines: fc.constantFrom(1, 2), scale: short })), { minLength: 1, maxLength: 5 }), fc.boolean(), uniform(0.3, 1), (forms, wrap, minScale) => {
      const got = pickSpelling(forms, { wrap, minScale });
      expect(forms).toContain(got);
      const allowed = wrap ? forms : forms.filter((f, i) => i === 0 || f.lines === 1);
      expect(allowed).toContain(got);
      const whole = allowed.find((f) => f.scale >= 1);
      if (whole) { expect(got).toBe(whole); t.count('whole'); return; }
      const best = Math.max(...allowed.map((f) => f.scale));
      const broken = wrap ? allowed.filter((f) => f.lines > 1 && f.scale >= minScale) : [];
      if (broken.length) { expect(broken).toContain(got); expect(got.scale).toBeGreaterThan(Math.max(...broken.map((f) => f.scale)) - 0.011); t.count('wrapped'); }
      else { expect(got.scale).toBeGreaterThan(best - 0.011); t.count('largest'); }
    }), runs(RUNS));
    for (const k of ['whole', 'largest']) t.atLeast(k, 50);
    t.atLeast('wrapped', 10);
  }, timeoutFor(RUNS, 1));
});

describe('clampScale and resolveBankScales', () => {
  it('keep every scale in minScale..1, and give every single-line member one scale, the smallest it needs', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.record({ scale, wrapped: fc.boolean() }), { maxLength: 6 }), uniform(0.3, 1), (members, minScale) => {
      const out = resolveBankScales(members, minScale);
      expect(out).toHaveLength(members.length);
      for (const s of out) { expect(s).toBeGreaterThanOrEqual(minScale); expect(s).toBeLessThanOrEqual(1); }
      const single = members.flatMap((m, i) => (m.wrapped ? [] : [i]));
      if (single.length > 1) t.count('shared');
      for (const i of single) expect(out[i]).toBe(clampScale(Math.min(...single.map((j) => members[j]!.scale)), minScale));
      members.forEach((m, i) => { if (m.wrapped) expect(out[i]).toBe(clampScale(m.scale, minScale)); });
    }), runs(RUNS));
    t.atLeast('shared', 100);
  }, timeoutFor(RUNS, 1));
});

describe('spellingsOf, shrunk counterexample', () => {
  it('gives a legend named constructor no alternates, rather than throwing', () => {
    expect(spellingsOf('constructor', KEY_SPELLINGS)).toEqual(['constructor']);
  });
});
