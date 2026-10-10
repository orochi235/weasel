import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { packageOptions, publicEntries, specifierOf } from './packageOptions.mjs';

const made = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A package on disk with the given `exports` and source files. */
function pkg(exports, sources) {
  const dir = mkdtempSync(join(tmpdir(), 'weasel-typedoc-'));
  made.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@weasel-js/demo', exports }));
  for (const source of sources) {
    mkdirSync(join(dir, source, '..'), { recursive: true });
    writeFileSync(join(dir, source), '');
  }
  return dir;
}

const types = (path) => ({ import: { types: path, default: path.replace('.d.ts', '.js') } });

describe('publicEntries', () => {
  it('finds the source mirroring each export, .ts or .tsx', () => {
    const dir = pkg(
      { '.': types('./dist/index.d.ts'), './react': types('./dist/react/index.d.ts') },
      ['src/index.ts', 'src/react/index.tsx'],
    );
    expect(publicEntries(dir)).toEqual([
      { specifier: '@weasel-js/demo', source: 'src/index.ts' },
      { specifier: '@weasel-js/demo/react', source: 'src/react/index.tsx' },
    ]);
  });

  it('leaves out stylesheets, wildcards, and the entries that are not public API', () => {
    const dir = pkg(
      {
        '.': types('./dist/index.d.ts'),
        './style.css': './dist/style.css',
        './components/*': types('./dist/components/*/index.d.ts'),
        './test-seams': types('./dist/test-seams.d.ts'),
        './internal': types('./dist/internal.d.ts'),
        './package.json': './package.json',
      },
      ['src/index.ts'],
    );
    expect(publicEntries(dir).map((e) => e.specifier)).toEqual(['@weasel-js/demo']);
  });

  it('asks sourceOf first, for an export built from somewhere else', () => {
    const dir = pkg(
      { '.': types('./dist/index.d.ts'), './math': types('./dist/math.d.ts') },
      ['src/index.ts', 'src/shims/math.ts'],
    );
    const sourceOf = (key) => (key === './math' ? 'src/shims/math.ts' : undefined);
    expect(publicEntries(dir, sourceOf).map((e) => e.source)).toEqual(['src/index.ts', 'src/shims/math.ts']);
  });

  it('throws on an export with no source, naming it', () => {
    const dir = pkg({ './math': types('./dist/math.d.ts') }, []);
    expect(() => publicEntries(dir)).toThrow(/@weasel-js\/demo: export "\.\/math" has no source at src\/math\.ts/);
  });
});

describe('packageOptions', () => {
  it('gives TypeDoc the sources and remembers what each is imported by', () => {
    const dir = pkg(
      { '.': types('./dist/index.d.ts'), './react': types('./dist/react.d.ts') },
      ['src/index.ts', 'src/react.ts'],
    );
    const options = packageOptions(dir, { intentionallyNotExported: ['Join'] });
    expect(options.entryPoints).toEqual(['src/index.ts', 'src/react.ts']);
    expect(options.intentionallyNotExported).toEqual(['Join']);
    expect(specifierOf(join(dir, 'src/react.ts'))).toBe('@weasel-js/demo/react');
    expect(specifierOf(join(dir, 'src/other.ts'))).toBeUndefined();
  });
});
