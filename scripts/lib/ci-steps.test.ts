import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { builtSteps, jobSteps, offFleetNodes, readCi, sourceChecks } from './ci-steps.mjs';

const FIXTURE = `
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        # the floor and the target
        node: [22, 24]
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
      - if: matrix.node == 24
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
    expect(ci.steps[9].if).toBe('matrix.node == 24');
  });
});

describe('the Node versions the matrix runs', () => {
  it('reads them from the job', () => {
    expect(readCi(FIXTURE).nodes).toEqual([22, 24]);
  });

  it('leaves out the one every fleet node runs', () => {
    expect(offFleetNodes([22, 24], '24\n')).toEqual([22]);
    expect(offFleetNodes([24], 'v24')).toEqual([]);
  });
});

describe('the whole job on one Node version', () => {
  const { steps } = readCi(FIXTURE);

  it('runs from the install on, without the global npm install the runner does itself', () => {
    const runs = jobSteps(steps, 22).map((step) => step.run);
    expect(runs[0]).toBe('npm ci');
    expect(runs).toContain('npm run check:bumps');
    expect(runs).toContain('npx vitest run --project=core');
    expect(runs).toContain('npm run check:manifests');
  });

  it('keeps a step for one Node version only on that version', () => {
    expect(jobSteps(steps, 22).map((step) => step.run)).not.toContain('npm run build:demo\nnpm run build:draw');
    expect(jobSteps(steps, 24).map((step) => step.run)).toContain('npm run build:demo\nnpm run build:draw');
  });

  it('refuses a step reading a workflow expression it cannot evaluate', () => {
    const odd = readCi(FIXTURE.replace("npx vitest run --project=core", "npx vitest run --project=\${{ matrix.project }}"));
    expect(() => jobSteps(odd.steps, 22)).toThrow(/matrix\.project/);
  });
});

describe('the split at the first build', () => {
  const { steps } = readCi(FIXTURE);

  it('gives the gate the check steps above it, as the arguments after `npm run`', () => {
    expect(sourceChecks(steps)).toEqual([['check:bumps'], ['audit:jsdoc', '--', '--quiet', '--check'], ['typecheck']]);
  });

  it('gives the post-build job every step from the build on', () => {
    expect(builtSteps(steps, 24).map((step) => step.run)).toEqual([
      'npm run build',
      'npx vitest run --project=forge-node a.test.ts',
      'npm run check:manifests',
      'npm run build:demo\nnpm run build:draw',
    ]);
  });

  it('keeps a step for one Node version only on that version', () => {
    expect(builtSteps(steps, 22).map((step) => step.run)).not.toContain('npm run build:demo\nnpm run build:draw');
  });

  it('refuses a condition it cannot evaluate, rather than guess', () => {
    const odd = readCi(FIXTURE.replace('matrix.node == 24', "github.event_name == 'push'"));
    expect(() => builtSteps(odd.steps, 24)).toThrow(/github\.event_name/);
  });
});

describe('ci.yml itself', () => {
  const { steps } = readCi(readFileSync(join(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8'));
  const built = builtSteps(steps, 24).map((step) => step.run);

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

  it('runs on a Node version the fleet does not', () => {
    const { nodes } = readCi(readFileSync(join(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8'));
    const nvmrc = readFileSync(join(import.meta.dirname, '../../.nvmrc'), 'utf8');
    expect(offFleetNodes(nodes, nvmrc).length).toBeGreaterThan(0);
    expect(jobSteps(steps, offFleetNodes(nodes, nvmrc)[0]).map((step) => step.run)).toContain('npm run test:browser');
  });

  it('leaves the gate none of them', () => {
    const gate = sourceChecks(steps).map((args) => `npm run ${args.join(' ')}`);
    expect(gate).toContain('npm run typecheck');
    expect(gate).toContain('npm run lint');
    expect(gate.filter((run) => built.includes(run))).toEqual([]);
  });
});
