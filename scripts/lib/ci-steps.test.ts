import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { builtSteps, readCi, sourceChecks } from './ci-steps.mjs';

const FIXTURE = `
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NPM_CONFIG_LOGLEVEL: error
      # a comment between entries
      NPM_VERSION: 12.0.2
    steps:
      - uses: actions/checkout@v7
      - run: npm install -g npm@\${{ env.NPM_VERSION }}
      - run: npm ci
      # explains the next step
      - run: npm run check:bumps
      - run: npm run audit:jsdoc -- --quiet --check
      - run: npx vitest run --project=core
      - run: npm run typecheck
      - run: npm run build
      - run: npx vitest run --project=forge-node a.test.ts
        env:
          FORGE_BUILT: '1'
      - run: npm run check:manifests
      - if: github.event_name == 'push'
        run: |
          npm run build:demo
          npm run build:draw
`;

describe('readCi', () => {
  const ci = readCi(FIXTURE);

  it("reads the job's env, skipping comments", () => {
    expect(ci.env).toEqual({ NPM_CONFIG_LOGLEVEL: 'error', NPM_VERSION: '12.0.2' });
  });

  it('reads every step that runs something, with its own env and condition', () => {
    expect(ci.steps.map((step) => step.run)).toEqual([
      'npm install -g npm@${{ env.NPM_VERSION }}',
      'npm ci',
      'npm run check:bumps',
      'npm run audit:jsdoc -- --quiet --check',
      'npx vitest run --project=core',
      'npm run typecheck',
      'npm run build',
      'npx vitest run --project=forge-node a.test.ts',
      'npm run check:manifests',
      'npm run build:demo\nnpm run build:draw',
    ]);
    expect(ci.steps[7].env).toEqual({ FORGE_BUILT: '1' });
    expect(ci.steps[9].if).toBe("github.event_name == 'push'");
  });
});

describe('the split at the first build', () => {
  const { steps } = readCi(FIXTURE);

  it('gives the gate the check steps above it, as the arguments after `npm run`', () => {
    expect(sourceChecks(steps)).toEqual([['check:bumps'], ['audit:jsdoc', '--', '--quiet', '--check'], ['typecheck']]);
  });

  it('refuses a check with a condition or an env of its own, which the gate would run without', () => {
    const at = (fixture: string) => readCi(fixture).steps;
    expect(() => sourceChecks(at(FIXTURE.replace('      - run: npm run check:bumps', "      - if: github.event_name == 'push'\n        run: npm run check:bumps")))).toThrow(/github\.event_name/);
    expect(() => sourceChecks(at(FIXTURE.replace('      - run: npm run check:bumps', '      - run: npm run check:bumps\n        env:\n          STRICT: 1')))).toThrow(/STRICT/);
    expect(() => sourceChecks(at(FIXTURE.replace('npm run check:bumps', 'npm run check:bumps -- ${{ env.X }}')))).toThrow(/env\.X/);
  });

  it('gives the post-build job every step from the build on', () => {
    expect(builtSteps(steps.slice(0, -1)).map((step) => step.run)).toEqual([
      'npm run build',
      'npx vitest run --project=forge-node a.test.ts',
      'npm run check:manifests',
    ]);
  });

  it('refuses a step condition, which it cannot evaluate off CI, rather than guess', () => {
    expect(() => builtSteps(steps)).toThrow(/github\.event_name/);
    const node = readCi(FIXTURE.replace("github.event_name == 'push'", 'matrix.node == 24'));
    expect(() => builtSteps(node.steps)).toThrow(/matrix\.node/);
  });
});

describe('ci.yml itself', () => {
  const { steps } = readCi(readFileSync(join(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8'));
  const built = builtSteps(steps).map((step) => step.run);

  it('splits so the post-build steps run only after a build', () => {
    expect(built[0]).toBe('npm run build');
    expect(built).toEqual(expect.arrayContaining([
      'npm run check:manifests',
      'npm run check:treeshake',
      'npm run check:react-free',
      'npm run test:smoke:consumer -w @weasel-js/labkit',
      'npm run test:smoke:consumer',
    ]));
  });

  it('leaves the gate none of them', () => {
    const gate = sourceChecks(steps).map((args) => `npm run ${args.join(' ')}`);
    expect(gate).toContain('npm run typecheck');
    expect(gate).toContain('npm run lint');
    expect(gate.filter((run) => built.includes(run))).toEqual([]);
  });
});
