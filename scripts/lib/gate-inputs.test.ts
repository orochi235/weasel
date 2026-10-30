import { describe, expect, it } from 'vitest';
import { CHECK_INPUTS, skipReason } from './gate-inputs.mjs';

const branch = (changed: string[], reshaped: string[] = []) => ({ changed, reshaped });
const scripts = Object.keys(CHECK_INPUTS);

describe('skipReason', () => {
  it('runs every check when the run tests everything', () => {
    for (const script of scripts) expect(skipReason(script, undefined)).toBeUndefined();
    expect(skipReason('check:needs', null)).toBeUndefined();
  });

  it('runs a check with no recorded inputs on any branch', () => {
    expect(skipReason('typecheck', branch(['docs/fleet.md']))).toBeUndefined();
    expect(skipReason('lint', branch([]))).toBeUndefined();
  });

  it('skips every listed check for a docs-only branch', () => {
    for (const script of scripts) expect(skipReason(script, branch(['docs/fleet.md']))).toMatch(/none of/);
  });

  it('runs the package checks when a package source file changes', () => {
    const core = branch(['packages/core/src/scene/Scene.ts']);
    expect(skipReason('check:needs', core)).toBeUndefined();
    expect(skipReason('audit:jsdoc', core)).toBeUndefined();
    expect(skipReason('check:forge-stories', core)).toBeUndefined();
    expect(skipReason('check:first-publish', core)).toMatch(/none of/);
    expect(skipReason('check:test-projects', core)).toMatch(/none of/);
  });

  it('runs forge-stories, and none of the package-only checks, for a draw change', () => {
    const draw = branch(['apps/draw/src/App.tsx']);
    expect(skipReason('check:forge-stories', draw)).toBeUndefined();
    expect(skipReason('check:needs', draw)).toMatch(/none of/);
    expect(skipReason('audit:jsdoc', draw)).toMatch(/none of/);
  });

  it('runs first-publish for any manifest, the root one included', () => {
    expect(skipReason('check:first-publish', branch(['packages/geom/package.json']))).toBeUndefined();
    expect(skipReason('check:first-publish', branch(['package.json']))).toBeUndefined();
    expect(skipReason('check:first-publish', branch(['scripts/trust-pending.json']))).toBeUndefined();
  });

  it('runs every check when ci.yml, the gate, a tsconfig, the lockfile or a script helper changes', () => {
    const paths = ['.github/workflows/ci.yml', 'scripts/ci-checks.gate.ts', 'tsconfig.json', 'packages/tsconfig.json', 'package-lock.json', 'scripts/lib/registry.mjs'];
    for (const path of paths) {
      for (const script of scripts) expect(skipReason(script, branch([path])), `${script} on ${path}`).toBeUndefined();
    }
  });

  it('runs test-projects for a test file added or deleted, not one only edited', () => {
    const test = 'apps/site/src/thing.test.ts';
    expect(skipReason('check:test-projects', branch([test]))).toMatch(/none of/);
    expect(skipReason('check:test-projects', branch([test], [test]))).toBeUndefined();
    expect(skipReason('check:test-projects', branch(['tests/e2e/helpers/a.spec.mjs'], ['tests/e2e/helpers/a.spec.mjs']))).toBeUndefined();
    expect(skipReason('check:test-projects', branch(['apps/site/src/thing.ts'], ['apps/site/src/thing.ts']))).toMatch(/none of/);
  });

  it('runs test-projects when a vitest config changes', () => {
    for (const path of ['vitest.config.ts', 'vitest.setup.ts', 'packages/ui/vite.config.ts', 'scripts/vitest-overlap.mjs']) {
      expect(skipReason('check:test-projects', branch([path])), path).toBeUndefined();
    }
  });
});
