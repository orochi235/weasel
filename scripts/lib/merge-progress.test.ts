import { describe, expect, it } from 'vitest';
import { mergeProgress } from './merge-progress.mjs';

const tally = (passed: number, failed: number, skipped: number) => {
  const total = passed + failed + skipped;
  return [
    `onto: plan 0/${total} tests`,
    `onto: progress ${total}/${total} tests`,
    ...(failed ? [`onto: failed ${failed}/${total} tests`] : []),
    `onto: tests ${passed} passed ${failed} failed ${skipped} skipped`,
  ];
};

describe('mergeProgress', () => {
  it('reports the sum of every child', () => {
    const m = mergeProgress(2);
    expect(m.line(0, 'onto: plan 0/100 tests')).toEqual(['onto: plan 0/100 tests', 'onto: progress 0/100 tests']);
    expect(m.line(1, 'onto: plan 0/50 tests')).toEqual([]);
    expect(m.line(0, 'onto: progress 10/100 tests')).toEqual(['onto: progress 10/150 tests']);
    expect(m.line(1, 'onto: progress 5/50 tests')).toEqual(['onto: progress 15/150 tests']);
    expect(m.line(1, 'onto: failed 1/50 tests')).toEqual(['onto: failed 1/150 tests']);
  });

  it('never lowers the total before the end', () => {
    const m = mergeProgress(2, 200);
    m.line(0, 'onto: plan 0/100 tests');
    expect(m.line(0, 'onto: progress 1/100 tests')).toEqual(['onto: progress 1/200 tests']);
    for (const l of tally(90, 0, 0)) m.line(0, l);
    expect(m.line(1, 'onto: progress 3/40 tests')).toEqual(['onto: progress 93/200 tests']);
  });

  it('prints one tally for the whole run, with the exact total', () => {
    const m = mergeProgress(2, 300);
    const printed = [...tally(90, 1, 2).flatMap((l) => m.line(0, l)), ...tally(40, 0, 0).flatMap((l) => m.line(1, l))];
    expect(printed.filter((l) => l.startsWith('onto: tests'))).toEqual([]);
    expect(m.finish()).toEqual(['onto: plan 0/133 tests', 'onto: progress 133/133 tests', 'onto: failed 1/133 tests', 'onto: tests 130 passed 1 failed 2 skipped']);
    expect(m.finish()).toEqual([]);
  });

  it('tallies the children that ran a test, and nothing when none did', () => {
    expect(mergeProgress(2).finish()).toEqual([]);
    const m = mergeProgress(2);
    for (const l of tally(5, 0, 0)) m.line(1, l);
    expect(m.finish().at(-1)).toBe('onto: tests 5 passed 0 failed 0 skipped');
  });

  it('passes other lines through', () => {
    expect(mergeProgress(1).line(0, 'something else')).toEqual(['something else']);
  });
});
