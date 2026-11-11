/**
 * Property tests of sweeps: a range walks from its start, a step apart, to at or before its end, both ends exact
 * where they are walked; `at` reaches the ends and agrees with the walk; frames keep their spacing, end on the
 * run's end, and stop a looping pass short of its own; `until` and `stepsOf` take prefixes.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally } from './pbt.fixture';
import { frames, range, stepsOf, until, values } from './sweep';

const RUNS = 400;
const near = (a: number, b: number, scale: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(scale));

const end = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: -100, max: 100 }) },
  { weight: 2, arbitrary: fc.double({ min: -1e6, max: 1e6, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0.1, 0.3, 123456.7890123, -0.123456789012345, 1e-7, 1e15 + 0.5) },
);
const stepSize = fc.oneof(fc.constantFrom(0.1, 0.25, 1, 2, 0.3, 7, 1e-3), fc.double({ min: 1e-3, max: 1e5, noNaN: true }));

describe('range', () => {
  it('with a step, walks from the start a step apart to at or before the end, and `at` agrees', () => {
    const t = tally();
    fc.assert(fc.property(end, end, stepSize, (from, to, step) => {
      fc.pre(Math.abs(to - from) / step < 5000);
      const s = range({ from, to, step });
      const { steps, capped } = stepsOf(s, 6000);
      expect(capped).toBe(false);
      expect(steps[0]).toBe(from);
      const dir = to < from ? -1 : 1;
      const scale = Math.max(Math.abs(from), Math.abs(to), step);
      steps.forEach((v, i) => expect(near(v, from + dir * step * i, scale)).toBe(true));
      const last = steps.at(-1)!;
      expect(dir * (to - last)).toBeGreaterThanOrEqual(-1e-9 * scale);
      expect(dir * (to - last)).toBeLessThan(step + 1e-9 * scale);
      expect(s.at(0)).toBe(from);
      expect(s.at(1)).toBe(last);
      expect(s.at(-3)).toBe(from);
      for (const u of [0.25, 0.5, 0.9]) expect(steps).toContain(s.at(u));
      t.count(steps.length > 1 ? 'walked' : 'one');
    }), runs(RUNS));
    t.atLeast('walked', RUNS / 3);
  });

  it('with a count, walks that many evenly, both ends exact, and `at` runs continuously between them', () => {
    const t = tally();
    fc.assert(fc.property(end, end, fc.integer({ min: 1, max: 30 }), fc.double({ min: 0, max: 1, noNaN: true }), (from, to, count, u) => {
      const s = range({ from, to, count });
      const steps = [...s.walk()];
      expect(steps.length).toBe(count);
      expect(steps[0]).toBe(from);
      if (count > 1) expect(steps.at(-1)).toBe(to);
      const scale = Math.max(Math.abs(from), Math.abs(to));
      steps.forEach((v, i) => { if (count > 1) expect(near(v, from + ((to - from) * i) / (count - 1), scale)).toBe(true); });
      expect(s.at(0)).toBe(from);
      expect(s.at(1)).toBe(to);
      const v = s.at(u);
      expect(v).toBeGreaterThanOrEqual(Math.min(from, to));
      expect(v).toBeLessThanOrEqual(Math.max(from, to));
      t.count(count > 1 ? 'many' : 'one');
    }), runs(RUNS));
    t.atLeast('many', RUNS / 2);
  });
});

describe('values, until, and stepsOf', () => {
  it('values reaches both ends and snaps to the nearest', () => {
    fc.assert(fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 8 }), fc.double({ min: -1, max: 2, noNaN: true }), (list, u) => {
      const s = values(list);
      expect(s.at(0)).toBe(list[0]);
      expect(s.at(1)).toBe(list.at(-1));
      const c = Math.min(1, Math.max(0, u));
      expect(s.at(u)).toBe(list[Math.round(c * (list.length - 1))]);
    }), runs(RUNS));
  });

  it('until walks the prefix before the first step it accepts, and stepsOf the first cap', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 12 }), fc.integer({ min: 0, max: 9 }), fc.integer({ min: 0, max: 14 }), (list, stop, cap) => {
      const cut = list.indexOf(stop);
      const prefix = cut < 0 ? list : list.slice(0, cut);
      expect([...until(values([0, ...list]), (v, i) => i > 0 && v === stop).walk()]).toEqual([0, ...prefix]);
      expect(stepsOf(values([0, ...list]), cap)).toEqual({ steps: [0, ...list].slice(0, cap), capped: list.length + 1 > cap });
    }), runs(RUNS));
  });
});

describe('frames', () => {
  it('walks from 0 a frame apart, ends a run on its end and a looping pass short of its own', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.oneof(fc.integer({ min: 0, max: 2000 }), fc.double({ min: 0, max: 2000, noNaN: true }), fc.constantFrom(1000, 400, 250)),
      fc.oneof(fc.constantFrom(1000 / 60, 100, 16, 33.3, 0.1), fc.double({ min: 1, max: 500, noNaN: true })),
      fc.constantFrom<boolean | number>(false, true, 1, 2, 2.5, 0),
      fc.constantFrom('first', 'all' as const),
      (duration, every, loop, passes) => {
        fc.pre(!(passes === 'all' && loop === true));
        const s = frames({ duration, loop }, { every, passes });
        const { steps, capped } = stepsOf(s, 5000);
        fc.pre(!capped);
        const count = loop === true ? Infinity : loop === false ? 1 : Math.max(0, loop);
        const walked = passes === 'all' ? count : 1;
        const span = duration === 0 || walked === 0 ? 0 : duration * walked;
        const ends = walked === count;
        expect(steps[0]).toBe(0);
        for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeGreaterThan(steps[i - 1]!);
        const body = ends && steps.length > 1 && steps.at(-1) === span ? steps.slice(0, -1) : steps;
        body.forEach((v, i) => expect(near(v, every * i, span)).toBe(true));
        if (ends) { expect(steps.at(-1)).toBe(span); t.count('ends'); }
        else { expect(steps.at(-1)!).toBeLessThan(span); t.count('loops'); }
        expect(s.at(0)).toBe(0);
        expect(s.at(1)).toBe(span);
      },
    ), runs(RUNS));
    t.atLeast('ends', RUNS / 4);
    t.atLeast('loops', RUNS / 10);
  });
});

describe('shrunk counterexamples', () => {
  it('a range keeps an end written with more than twelve digits', () => {
    expect([...range({ from: -1.706187340793e-312, to: 0, step: 0.1 }).walk()]).toEqual([-1.706187340793e-312]);
    expect(range({ from: 0, to: 3.151181923013e-312, count: 1 }).at(1)).toBe(3.151181923013e-312);
    expect([...range({ from: 123456.7890123, to: 2e5, count: 2 }).walk()]).toEqual([123456.7890123, 2e5]);
  });

  it('a range given a count reads `at` inside its ends', () => {
    expect(range({ from: 0, to: 60079.85937499993, count: 1 }).at(0.9999999999999996)).toBeLessThanOrEqual(60079.85937499993);
    expect(range({ from: 9.565119516300001e-301, to: 9.565119516300001e-301, count: 1 }).at(5e-324)).toBe(9.565119516300001e-301);
  });
});
