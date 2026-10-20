/**
 * A test that times out on a loaded machine is retried once, and every
 * timeout is still reported, as a warning. More than {@link TIMEOUT_BUDGET}
 * distinct tests timing out in one run fails it: past that, the run is too
 * loaded to trust whatever passed on a retry.
 *
 * The retry is vitest's own, decided in each worker; the budget is counted in
 * the main process at the end, so a run past it has still retried every
 * timeout once before failing.
 */
import type { Plugin } from 'vite';
import type { Reporter, TestCase, TestModule, Vitest } from 'vitest/node';

export const TIMEOUT_BUDGET = 10;

/** What every project's `test.retry` is: once, and only for a timeout. */
export const RETRY_TIMEOUTS = { count: 1, condition: /^(Test|Hook) timed out in \d+ms/ };

/** One test that timed out, and whether its retry passed. */
export interface TimedOut {
  name: string;
  passed: boolean;
}

/** The tests in `cases` that timed out at least once. */
export function timedOut(cases: Iterable<Pick<TestCase, 'fullName' | 'result'> & { module: { moduleId: string } }>): TimedOut[] {
  const out: TimedOut[] = [];
  for (const test of cases) {
    const result = test.result();
    if (!(result.errors ?? []).some((e) => RETRY_TIMEOUTS.condition.test(e.message ?? ''))) continue;
    out.push({ name: `${test.module.moduleId} > ${test.fullName}`, passed: result.state === 'passed' });
  }
  return out;
}

/** The warning a run prints, and the error that fails it when the budget is spent; `null` for none. */
export function timeoutReport(found: readonly TimedOut[], budget = TIMEOUT_BUDGET): { warning: string; error: string | null } | null {
  if (found.length === 0) return null;
  const lines = found.map((t) => `  ${t.passed ? 'passed on retry' : 'failed again  '}  ${t.name}`);
  const warning = [`⚠ ${found.length} test(s) timed out and were retried once:`, ...lines].join('\n');
  const error = found.length > budget
    ? `${found.length} tests timed out, more than the ${budget} a run may retry: the machine is too loaded to trust this run.`
    : null;
  return { warning, error };
}

class TimeoutReporter implements Reporter {
  constructor(private readonly vitest: Vitest) {}

  onTestRunEnd(modules: readonly TestModule[]): void {
    const report = timeoutReport(timedOut(modules.flatMap((m) => [...m.children.allTests()])));
    if (report === null) return;
    this.vitest.logger.warn(`\n${report.warning}\n`);
    if (report.error === null) return;
    this.vitest.logger.error(`${report.error}\n`);
    process.exitCode = 1;
  }
}

/**
 * Adds the timeout reporter beside whatever reporters the run was given. A
 * reporter in the config would be dropped by any `--reporter` on the command
 * line, which is how onto runs the suite.
 */
export function timeoutRetries(): Plugin {
  const seen = new WeakSet<Vitest>();
  return {
    name: 'weasel:timeout-retries',
    configureVitest({ vitest }) {
      if (seen.has(vitest)) return;
      seen.add(vitest);
      vitest.config.reporters.push(new TimeoutReporter(vitest));
    },
  };
}
