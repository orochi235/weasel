import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

  it('takes an entry file over the module that shares its name', () => {
    const dir = pkg(
      { '.': types('./dist/index.d.ts'), './layout': types('./dist/layout.d.ts') },
      ['src/index.ts', 'src/layout.ts', 'src/layout.entry.ts'],
    );
    expect(publicEntries(dir).map((e) => e.source)).toEqual(['src/index.ts', 'src/layout.entry.ts']);
  });

  it('throws on an export with no source, naming it', () => {
    const dir = pkg({ './math': types('./dist/math.d.ts') }, []);
    expect(() => publicEntries(dir)).toThrow(/@weasel-js\/demo: export "\.\/math" has no source under src\//);
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

  it('builds the package from its own sources, on the shared options', () => {
    const dir = pkg({ '.': types('./dist/index.d.ts') }, ['src/index.ts']);
    const { tsconfig } = packageOptions(dir);
    const written = JSON.parse(readFileSync(tsconfig, 'utf8'));
    expect(tsconfig).toBe(join(dir, 'tsconfig.docs.json'));
    expect(written.include).toEqual(['src']);
    expect(resolve(dir, written.extends)).toBe(join(import.meta.dirname, 'tsconfig.json'));
  });
});
