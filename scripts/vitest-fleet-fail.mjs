/**
 * A vitest reporter printing one `fleet-fail:` line the moment a test fails, so a session watching a
 * fleet run's log can start on the first failure while the rest still run (format: docs/fleet.md).
 * A gate check prints as `fleet-fail: gate <npm script>`; a file that fails with no failing test,
 * such as one that does not load, as `<project> <file> :: (file)`.
 *
 * A file the tree's marker lists as failing last run (`scripts/lib/fleet-first.mjs`) that fails again
 * cancels the run, with one `fleet-abort:` line: the rerun has already said what it would.
 */
import { relative } from 'node:path';
import { firstInTree } from './lib/fleet-first.mjs';

/** The line for one failure. A browser instance's project, `browser (chromium)`, prints as `browser:chromium`, one word. */
export const failLine = (name, file, test) => {
  const project = name.replace(/ \(([^)]+)\)/g, ':$1').replace(/\s+/g, '-');
  if (project === 'gate' && test?.startsWith('npm run ')) return `fleet-fail: gate ${test.slice('npm run '.length)}`;
  return `fleet-fail: ${project} ${file} :: ${test ?? '(file)'}`;
};

export default class FleetFailReporter {
  seen = new Set();
  root = process.cwd();
  failedIn = new Set();
  first = new Set();
  aborted = false;

  onInit(vitest) {
    this.vitest = vitest;
    this.root = vitest.config.root;
    this.first = new Set(firstInTree(this.root));
  }

  /** Cancels the run when `file`, which failed last run too, has failed again. */
  abortOn(file) {
    if (this.aborted || !this.first.has(file)) return;
    this.aborted = true;
    process.stdout.write(`\nfleet-abort: ${file} failed again, as it did in this branch's last run; stopping the rest\n`);
    void this.vitest?.cancelCurrentRun('test-failure');
  }

  print(line) {
    if (this.seen.has(line)) return;
    this.seen.add(line);
    // On a line of its own, even after a reporter that left one open.
    process.stdout.write(`\n${line}\n`);
  }

  onTestCaseResult(testCase) {
    if (testCase.result().state !== 'failed') return;
    const file = relative(this.root, testCase.module.moduleId);
    this.failedIn.add(testCase.module.moduleId);
    this.print(failLine(testCase.project.name, file, testCase.fullName));
    this.abortOn(file);
  }

  onTestModuleEnd(testModule) {
    if (testModule.state() !== 'failed' || this.failedIn.has(testModule.moduleId)) return;
    const file = relative(this.root, testModule.moduleId);
    this.print(failLine(testModule.project.name, file));
    this.abortOn(file);
  }
}
