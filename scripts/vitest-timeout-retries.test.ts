import { describe, expect, it } from 'vitest';
import { RETRY_TIMEOUTS, timedOut, timeoutReport } from './vitest-timeout-retries';

const test = (name: string, state: 'passed' | 'failed', ...messages: string[]) => ({
  fullName: name,
  module: { moduleId: 'a.test.ts' },
  result: () => ({ state, errors: messages.map((message) => ({ message })) }) as never,
});

describe('timeout retries', () => {
  it('retries a test or hook timeout and nothing else', () => {
    expect(RETRY_TIMEOUTS.condition.test('Test timed out in 5000ms.\nIf this is a long-running test…')).toBe(true);
    expect(RETRY_TIMEOUTS.condition.test('Hook timed out in 10000ms.')).toBe(true);
    expect(RETRY_TIMEOUTS.condition.test('expected 1 to be 2')).toBe(false);
  });

  it('finds the tests that timed out, and whether the retry passed', () => {
    const found = timedOut([
      test('slow', 'passed', 'Test timed out in 5000ms.'),
      test('stuck', 'failed', 'Test timed out in 5000ms.', 'Test timed out in 5000ms.'),
      test('wrong', 'failed', 'expected 1 to be 2'),
      test('fine', 'passed'),
    ]);
    expect(found).toEqual([{ name: 'a.test.ts > slow', passed: true }, { name: 'a.test.ts > stuck', passed: false }]);
  });

  it('warns for every timeout, and fails the run only past the budget', () => {
    expect(timeoutReport([])).toBeNull();
    const ten = Array.from({ length: 10 }, (_, i) => ({ name: `t${i}`, passed: true }));
    expect(timeoutReport(ten)).toMatchObject({ error: null });
    expect(timeoutReport(ten)!.warning).toContain('10 test(s) timed out');
    expect(timeoutReport([...ten, { name: 't10', passed: true }])!.error).toContain('more than the 10');
  });
});
