/**
 * A vitest reporter printing one `fleet-fail:` line the moment a test fails, so a session watching a
 * fleet run's log can start on the first failure while the rest still run (format: docs/fleet.md).
 * A gate check prints as `fleet-fail: gate <npm script>`; a file that fails with no failing test,
 * such as one that does not load, as `<project> <file> :: (file)`.
 */
import { relative } from 'node:path';

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

  onInit(vitest) {
    this.root = vitest.config.root;
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
  }

  onTestModuleEnd(testModule) {
    if (testModule.state() !== 'failed' || this.failedIn.has(testModule.moduleId)) return;
    this.print(failLine(testModule.project.name, relative(this.root, testModule.moduleId)));
  }
}
