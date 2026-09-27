import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMOS } from '../registry';

/** Repo root, from `apps/site/__tests__/`. */
const ROOT = resolve(__dirname, '../../..');

const source = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

// A demo filed under a package shows that package, and importing it through
// core's re-exports teaches nothing about using the package on its own.
describe('package demos', () => {
  it('import their own package', () => {
    const bad = DEMOS.filter(
      (d) => d.package && !new RegExp(`from '@weasel-js/${d.package}(/[^']*)?'`).test(source(d.path)),
    );
    expect(bad.map((d) => `${d.id} (${d.package})`)).toEqual([]);
  });

  it('never reach into a package by relative path', () => {
    const bad = DEMOS.filter((d) => /from '(\.\.\/)+packages\//.test(source(d.path)));
    expect(bad.map((d) => d.id)).toEqual([]);
  });
});
