/**
 * Writes this vitest process's {@link loadReport} to `$WEASEL_LOAD_REPORT` when the run ends, for
 * `scripts/vitest-overlap.mjs` to rerun the files a network change kept from loading.
 */
import { writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import type { Reporter, TestModule, Vitest } from 'vitest/node';
import { loadReport, networkChanged } from './lib/load-reruns.mjs';
import { timedOut, timeoutReport } from './vitest-timeout-retries.ts';

class LoadReporter implements Reporter {
  constructor(
    private readonly vitest: Vitest,
    private readonly out: string,
  ) {}

  onTestRunEnd(modules: readonly TestModule[], unhandledErrors: readonly unknown[]): void {
    const report = loadReport(modules, {
      root: this.vitest.config.root,
      networkChanged: networkChanged(),
      unhandledErrors: unhandledErrors.length,
      timeoutBudgetSpent: Boolean(timeoutReport(timedOut(modules.flatMap((m) => [...m.children.allTests()])))?.error),
    });
    writeFileSync(this.out, JSON.stringify(report));
  }
}

const CLAIMED = Symbol.for('weasel:load-reruns');

export function loadReruns(): Plugin {
  return {
    name: 'weasel:load-reruns',
    configureVitest({ vitest }) {
      const out = process.env.WEASEL_LOAD_REPORT;
      // vitest evaluates the config again for every inline project; one reporter per run.
      const run = vitest as unknown as { [CLAIMED]?: true };
      if (!out || run[CLAIMED]) return;
      run[CLAIMED] = true;
      vitest.config.reporters.push(new LoadReporter(vitest, out));
    },
  };
}
