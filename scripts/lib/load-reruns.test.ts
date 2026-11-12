import { describe, expect, it } from 'vitest';
import { loadReport, networkChanged, noteNetworkChanged, rerunPlan, type ReportedModule } from './load-reruns.mjs';

const mod = (file: string, tests: string[], errors: unknown[] = []): ReportedModule => ({
  moduleId: `/repo/${file}`,
  state: () => (errors.length || tests.includes('failed') ? 'failed' : 'passed'),
  errors: () => errors,
  children: { allTests: () => tests.map((state) => ({ result: () => ({ state }) })) },
});

const opts = { root: '/repo', networkChanged: true };

describe('loadReport', () => {
  it('lists the files that loaded no tests', () => {
    const r = loadReport([mod('a.browser.test.ts', ['passed']), mod('b.browser.test.ts', [], [new Error('Failed to fetch')])], opts);
    expect(r).toEqual({ networkChanged: true, files: ['b.browser.test.ts'], otherFailures: false });
  });

  it('marks a failed test, an unhandled error, or a spent timeout budget', () => {
    expect(loadReport([mod('a.test.ts', ['failed'])], opts).otherFailures).toBe(true);
    expect(loadReport([], { ...opts, unhandledErrors: 1 }).otherFailures).toBe(true);
    expect(loadReport([], { ...opts, timeoutBudgetSpent: true }).otherFailures).toBe(true);
  });

  it('does not count a file that loaded and then failed in a hook as a load failure', () => {
    const r = loadReport([mod('a.test.ts', ['skipped'], [new Error('beforeAll')])], opts);
    expect(r.files).toEqual([]);
    expect(r.otherFailures).toBe(true);
  });
});

describe('rerunPlan', () => {
  const failedLoad = { networkChanged: true, files: ['b.browser.test.ts'], otherFailures: false };

  it('reruns load failures only in a run that logged a network change', () => {
    expect(rerunPlan([{ ...failedLoad, networkChanged: false }, null])).toEqual({ files: [], settles: [] });
    expect(rerunPlan([null, failedLoad])).toEqual({ files: ['b.browser.test.ts'], settles: [1] });
  });

  it('leaves the verdict of a process that failed on anything else', () => {
    expect(rerunPlan([{ ...failedLoad, otherFailures: true }])).toEqual({ files: ['b.browser.test.ts'], settles: [] });
  });
});

describe('noteNetworkChanged', () => {
  it('is read back by networkChanged', () => {
    noteNetworkChanged();
    expect(networkChanged()).toBe(true);
  });
});
