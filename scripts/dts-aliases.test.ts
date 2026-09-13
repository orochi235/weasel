import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { weaselTypeEntries, workspaceDependencyClosure } from './dts-aliases';

let root: string;

function pkg(dir: string, manifest: Record<string, unknown>): void {
  mkdirSync(join(root, 'packages', dir), { recursive: true });
  writeFileSync(join(root, 'packages', dir, 'package.json'), JSON.stringify(manifest));
}

function fixture(): void {
  root = mkdtempSync(join(tmpdir(), 'dts-aliases-'));
  const exports = { '.': { types: './dist/index.d.ts' } };
  pkg('core', { name: '@w/core', exports, dependencies: { '@w/geom': '*' } });
  pkg('geom', { name: '@w/geom', exports });
  pkg('ui', { name: '@w/ui', exports, peerDependencies: { '@w/core': '*' } });
  pkg('dev-only', { name: '@w/dev-only', exports });
  pkg('lab', {
    name: '@w/lab',
    exports,
    dependencies: { '@w/ui': '*', react: '*' },
    devDependencies: { '@w/dev-only': '*' },
  });
  pkg('forge', { name: '@w/forge', exports, peerDependencies: { '@w/lab': '*' } });
}

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('workspaceDependencyClosure', () => {
  it('follows dependencies and peers transitively, never dev deps or dependents', () => {
    fixture();
    expect(workspaceDependencyClosure(root, '@w/lab')).toEqual(['@w/core', '@w/geom', '@w/ui']);
  });

  it('limits type entries to the included packages', () => {
    fixture();
    const include = workspaceDependencyClosure(root, '@w/lab');
    const names = weaselTypeEntries(root, ['@w/core'], include).map((e) => e.specifier);
    expect(names.sort()).toEqual(['@w/geom', '@w/ui']);
  });
});
