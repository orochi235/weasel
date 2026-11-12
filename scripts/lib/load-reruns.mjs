// A browser test file whose import Chromium dropped on a macOS network change (`net::ERR_NETWORK_CHANGED`)
// loads no tests and fails whole; vitest retries tests, never a file's import. A vitest process writes one
// report of its run (`scripts/vitest-load-reruns.ts`), and `scripts/vitest-overlap.mjs` reruns those files.
import { relative } from 'node:path';

/**
 * What one vitest process's run leaves for a rerun: whether a network change dropped a request, the files
 * that loaded no tests, and whether anything else failed, which no rerun of those files can settle.
 */
export function loadReport(modules, { root, networkChanged, unhandledErrors = 0, timeoutBudgetSpent = false }) {
  const files = [];
  let otherFailures = unhandledErrors > 0 || timeoutBudgetSpent;
  for (const m of modules) {
    const tests = [...m.children.allTests()];
    if (tests.length === 0 && m.errors().length > 0) {
      files.push(relative(root, m.moduleId));
      continue;
    }
    if (m.state() === 'failed' || tests.some((t) => t.result().state === 'failed')) otherFailures = true;
  }
  return { networkChanged: Boolean(networkChanged), files, otherFailures };
}

/**
 * The files to run again, from every process's report (`null` where a process wrote none), and which
 * processes' exit codes the rerun stands in for: those that failed only on files it reruns.
 */
export function rerunPlan(reports) {
  const files = new Set();
  const settles = [];
  reports.forEach((r, i) => {
    if (!r?.networkChanged || r.files.length === 0) return;
    r.files.forEach((f) => files.add(f));
    if (!r.otherFailures) settles.push(i);
  });
  return { files: [...files].sort(), settles };
}
