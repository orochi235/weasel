// A vitest reporter that appends one JSON line per test file to $TEST_COSTS_OUT: its project and the
// worker time vitest spent on it, split the way `TestModule.diagnostic()` splits it. Several vitest
// processes (`scripts/vitest-overlap.mjs` runs two) may append to the one file.
// `node scripts/test-costs.mjs <file>` sums it by package.
import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';

export default class TestCostsReporter {
  rows = [];

  onInit(vitest) {
    this.root = vitest.config.root;
  }

  onTestModuleEnd(module) {
    const d = module.diagnostic();
    this.rows.push(
      JSON.stringify({
        project: module.project.name,
        file: relative(this.root, module.moduleId),
        tests: [...module.children.allTests()].length,
        environment: d.environmentSetupDuration,
        prepare: d.prepareDuration,
        setup: d.setupDuration,
        collect: d.collectDuration,
        run: d.duration,
      }),
    );
  }

  onTestRunEnd() {
    const out = process.env.TEST_COSTS_OUT;
    if (!out || !this.rows.length) return;
    appendFileSync(out, this.rows.join('\n') + '\n');
  }
}
