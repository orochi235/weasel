import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceEntries } from './lib/packageEntries.mjs';
import { coreTsconfigPaths, tsconfigPaths as generatedPaths } from './lib/tsconfigPaths.mjs';
import { weaselAliases } from './vite-aliases';

const REPO = resolve(__dirname, '..');
const aliases = weaselAliases(REPO);

function viaAliases(specifier: string): string | null {
  for (const { find, replacement } of aliases) {
    if (typeof find === 'string' ? find === specifier : find.test(specifier)) {
      return typeof find === 'string' ? replacement : specifier.replace(find, replacement);
    }
  }
  return null;
}

const inRepo = (specifier: string) => {
  const hit = viaAliases(specifier);
  return hit === null ? null : relative(REPO, hit);
};

/** `compilerOptions` from the tsconfig in `dir`, which allows comments. */
function compilerOptions(dir: string): { paths: Record<string, string[]>; rootDir?: string } | undefined {
  const raw = readFileSync(join(REPO, dir, 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(raw).compilerOptions;
}

const tsconfigPaths = (dir = '.') => compilerOptions(dir)!.paths;

/** Where TypeScript's `paths` sends a specifier: an exact key, else the wildcard key with the longest prefix. */
function viaPaths(paths: Record<string, string[]>, specifier: string): string | null {
  if (paths[specifier]) return join(paths[specifier][0]);
  let best: { prefix: string; target: string } | null = null;
  for (const [key, [target]] of Object.entries(paths)) {
    if (!key.endsWith('/*') || !specifier.startsWith(key.slice(0, -1))) continue;
    if (!best || key.length - 1 > best.prefix.length) best = { prefix: key.slice(0, -1), target };
  }
  return best ? join(best.target.replace('*', specifier.slice(best.prefix.length))) : null;
}

const SOURCE = /\.(ts|tsx|mts|mjs|css|less)$/;
const SKIPPED = new Set(['node_modules', 'dist', 'dist-demo', 'dist-draw', 'dist-forge', 'dist-theme-editor']);
/** A specifier in a position that resolves it: an import, an export, a mock, or a stylesheet `@import`. */
const IMPORTED = /(?:\bfrom|\bimport|\bmock|\bimportActual|\bimportOriginal|@import)\s*\(?\s*['"](@weasel-js\/[\w./-]+)['"?]/g;

function importedSpecifiers(): Map<string, string> {
  const seen = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (SKIPPED.has(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (SOURCE.test(name)) {
        for (const [, specifier] of readFileSync(path, 'utf8').matchAll(IMPORTED)) {
          if (!seen.has(specifier)) seen.set(specifier, relative(REPO, path));
        }
      }
    }
  };
  for (const dir of ['packages', 'apps', 'tests', 'scripts']) walk(join(REPO, dir));
  return seen;
}

const isFile = (path: string) => ['', '.ts', '.tsx', '.mjs'].some((ext) => existsSync(path + ext));

describe('weaselAliases', () => {
  it('sends a subpath to the file its entry is built from, not to the file of the same name', () => {
    expect(inRepo('@weasel-js/diagram/layout')).toBe('packages/diagram/src/layout.entry.ts');
    expect(inRepo('@weasel-js/core/move')).toBe('packages/core/src/import-shims/move.ts');
    expect(inRepo('@weasel-js/forge/play')).toBe('packages/forge/src/test/play.ts');
    expect(inRepo('@weasel-js/labkit/weasel-ui')).toBe('packages/labkit/src/passthrough/weasel-ui.ts');
    expect(inRepo('@weasel-js/ui/components/Button')).toBe('packages/ui/src/components/Button/index.ts');
    expect(inRepo('@weasel-js/theme/tokens.css')).toBe('packages/theme/src/generated/tokens.css');
  });

  it('has no alias for a subpath no exports map publishes', () => {
    expect(viaAliases('@weasel-js/labkit/lab/Lab')).toBeNull();
    expect(viaAliases('@weasel-js/labkit/styles.less')).toBeNull();
    expect(viaAliases('@weasel-js/geom/mat3')).toBeNull();
  });

  it("keeps a package's in-repo test helpers importable", () => {
    expect(inRepo('@weasel-js/react/testing/renderSettled')).toBe('packages/react/src/testing/renderSettled');
  });

  it('resolves every weasel specifier the repo imports to a file that exists', () => {
    // Only a build produces these.
    const built = new Set(['@weasel-js/ui/style.css', '@weasel-js/core/style.css', '@weasel-js/devtools/style.css']);
    const broken: string[] = [];
    for (const [specifier, file] of importedSpecifiers()) {
      if (built.has(specifier)) continue;
      const hit = viaAliases(specifier);
      if (!hit || !isFile(hit)) broken.push(`${specifier}  (${file})`);
    }
    expect(broken).toEqual([]);
  });
});

describe('the root tsconfig paths', () => {
  it('are what `npm run gen:tsconfig-paths` writes', () => {
    expect(tsconfigPaths()).toEqual(generatedPaths(REPO));
  });

  it('resolve no subpath an exports map does not publish, as the aliases do not', () => {
    const paths = tsconfigPaths();
    expect(viaPaths(paths, '@weasel-js/labkit/lab/Lab')).toBeNull();
    expect(viaPaths(paths, '@weasel-js/geom/mat3')).toBeNull();
    expect(viaPaths(paths, '@weasel-js/renderer/draw')).toBeNull();
  });

  it('send every exported entry to the same source file the aliases do', () => {
    const paths = tsconfigPaths();
    const wrong: string[] = [];
    for (const { dir, entries } of workspaceEntries(REPO)) {
      for (const entry of entries) {
        if (!entry.types || !entry.source || entry.specifier.includes('*')) continue;
        const want = relative(REPO, join(dir, entry.source));
        const got = viaPaths(paths, entry.specifier);
        if (got === null) wrong.push(`${entry.specifier}: no path; wants ./${want}`);
        else if (!isSameFile(got, want)) wrong.push(`${entry.specifier}: ${got}; wants ./${want}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('rootDir', () => {
  // A config's `paths` reach into sibling packages, and TS 6 defaults `rootDir` to the config's own directory.
  it('is the repo root for every package, so one typechecked alone has no TS6059', () => {
    expect(compilerOptions('.')?.rootDir).toBe('.');
    const own = readdirSync(join(REPO, 'packages'))
      .filter((name) => existsSync(join(REPO, 'packages', name, 'tsconfig.json')))
      .map((name) => [name, compilerOptions(join('packages', name))?.rootDir])
      .filter(([, rootDir]) => rootDir !== undefined);
    // Core and the icon plugin restate it: tsup resolves an inherited `rootDir` against the package.
    expect(own).toEqual([['core', '../..'], ['icons-plugin', '../..']]);
  });
});

describe("core's tsconfig paths", () => {
  it('are what `npm run gen:tsconfig-paths` writes', () => {
    expect(tsconfigPaths('packages/core')).toEqual(coreTsconfigPaths(REPO));
  });

  it('resolve no subpath an exports map does not publish', () => {
    const paths = tsconfigPaths('packages/core');
    expect(viaPaths(paths, '@weasel-js/geom/mat3')).toBeNull();
    expect(viaPaths(paths, '@weasel-js/core/nothing')).toBeNull();
  });

  it('send each entry they map to the file the root paths send it to', () => {
    const root = tsconfigPaths();
    const wrong: string[] = [];
    for (const [specifier, [target]] of Object.entries(tsconfigPaths('packages/core'))) {
      const got = relative(REPO, join(REPO, 'packages/core', target));
      const want = join(root[specifier]?.[0] ?? '');
      if (got !== want) wrong.push(`${specifier}: ${got}; the root has ${want}`);
    }
    expect(wrong).toEqual([]);
  });
});

/** A path names the file with or without its extension, or the directory holding its index. */
function isSameFile(got: string, want: string): boolean {
  const bare = want.replace(/\.tsx?$/, '');
  return got === want || got === bare || `${got}/index` === bare;
}
