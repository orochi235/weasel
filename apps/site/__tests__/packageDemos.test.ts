import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMOS } from '../registry';

/** Repo root, from `apps/site/__tests__/`. */
const ROOT = resolve(__dirname, '../../..');

const source = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** The demo file plus the sibling modules it imports: the same files its source tabs show. */
function demoSources(path: string): string[] {
  const own = source(path);
  const companions = [...own.matchAll(/from '(\.\/[^']+)'/g)].map((m) => {
    const base = resolve(ROOT, dirname(path), m[1]);
    const file = ['.ts', '.tsx'].map((ext) => base + ext).find((f) => existsSync(f));
    return file ? readFileSync(file, 'utf8') : '';
  });
  return [own, ...companions];
}

// A demo filed under a package shows that package, and importing it through
// core's re-exports teaches nothing about using the package on its own.
describe('package demos', () => {
  it('import their own package', () => {
    const bad = DEMOS.filter(
      (d) => d.package && !demoSources(d.path).some((s) => new RegExp(`from '@weasel-js/${d.package}(/[^']*)?'`).test(s)),
    );
    expect(bad.map((d) => `${d.id} (${d.package})`)).toEqual([]);
  });

  it('never reach into a package by relative path', () => {
    const bad = DEMOS.filter((d) => /from '(\.\.\/)+packages\//.test(source(d.path)));
    expect(bad.map((d) => d.id)).toEqual([]);
  });
});
