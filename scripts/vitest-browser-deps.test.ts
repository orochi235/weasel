import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { browserDeps } from './vitest-browser-deps.ts';

const ENTRIES = ['packages/**/*.browser.test.{ts,tsx}'];

let root: string;
const put = (path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const deps = (setupFiles: string[] = []) => browserDeps(root, { entries: ENTRIES, setupFiles });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'browser-deps-'));
  put(
    'packages/kit/package.json',
    JSON.stringify({
      name: '@fixture/kit',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './style.css': './dist/style.css' },
    }),
  );
  put('packages/kit/src/index.ts', `export { store } from './store';\n`);
  put('packages/kit/src/store.ts', `import { create } from 'zustand/vanilla';\nexport const store = create(() => 0);\n`);
  put('packages/kit/src/unreached.ts', `import 'never-loaded';\n`);
  put(
    'packages/app/package.json',
    JSON.stringify({ name: '@fixture/app', exports: { '.': { types: './dist/index.d.ts' } } }),
  );
  put('packages/app/src/index.ts', `export {};\n`);
  put('packages/app/src/Panel.tsx', `import { store } from '@fixture/kit';\nexport const Panel = () => <i>{store.getState()}</i>;\n`);
  put(
    'packages/app/src/Panel.browser.test.tsx',
    `import { render } from '@testing-library/react';\nimport { Panel } from './Panel';\nrender(<Panel />);\n`,
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('browserDeps', () => {
  it('lists what the entries import, through relative imports and workspace aliases', () => {
    expect(deps()).toEqual(['@testing-library/react', 'zustand/vanilla']);
  });

  it('gains a specifier first imported anywhere in an entry’s graph', () => {
    put(
      'packages/kit/src/store.ts',
      `import { create } from 'zustand/vanilla';\nimport { useShallow } from 'zustand/react/shallow';\nexport const store = create(() => useShallow);\n`,
    );
    expect(deps()).toEqual(['@testing-library/react', 'zustand/react/shallow', 'zustand/vanilla']);
  });

  it('follows a dynamic import and a .js specifier written for a .ts file', () => {
    put('packages/kit/src/lazy.ts', `import earcut from 'earcut';\nexport default earcut;\n`);
    put('packages/kit/src/index.ts', `export { store } from './store.js';\nexport const lazy = () => import('./lazy');\n`);
    expect(deps()).toEqual(['@testing-library/react', 'earcut', 'zustand/vanilla']);
  });

  it('is unchanged by an edit that imports nothing new', () => {
    const before = deps();
    put('packages/kit/src/more.ts', `import type { Draft } from 'immer';\nexport const more = 1;\n`);
    put(
      'packages/kit/src/store.ts',
      `// import 'left-pad';\nimport { create } from 'zustand/vanilla';\nimport { more } from './more';\nexport const store = create(() => more);\n`,
    );
    expect(deps()).toEqual(before);
  });

  it('is unchanged by an import in a module no entry reaches', () => {
    const before = deps();
    put('packages/kit/src/unreached.ts', `import 'never-loaded';\nimport 'nor-this';\n`);
    expect(deps()).toEqual(before);
  });

  it('passes over the directory a failed browser test leaves its screenshots in', () => {
    put('packages/app/src/__screenshots__/Panel.browser.test.tsx/fails-1.png', '');
    expect(deps()).toEqual(['@testing-library/react', 'zustand/vanilla']);
  });

  it('counts what a setup file imports', () => {
    put('setup.ts', `import 'axe-core';\n`);
    expect(deps(['./setup.ts'])).toEqual(['@testing-library/react', 'axe-core', 'zustand/vanilla']);
  });

  it('follows import.meta.glob into the files it matches, relative and root-absolute', () => {
    put('packages/kit/src/plugins/a.ts', `import 'dep-a';\n`);
    put('packages/kit/src/plugins/b.tsx', `import 'dep-b';\n`);
    put('packages/kit/src/plugins/skip.ts', `import 'dep-skipped';\n`);
    put('packages/kit/src/extra/c.ts', `import 'dep-c';\n`);
    put(
      'packages/kit/src/index.ts',
      [
        `export { store } from './store';`,
        `export const plugins = import.meta.glob<{ x: number }>(['./plugins/*.{ts,tsx}', '!**/skip.ts'], { eager: true });`,
        `export const extra = import.meta.glob("/packages/kit/src/extra/*.ts");`,
      ].join('\n'),
    );
    expect(deps()).toEqual(['@testing-library/react', 'dep-a', 'dep-b', 'dep-c', 'zustand/vanilla']);
  });

  it('does not follow a glob that loads its files as text or addresses', () => {
    put('packages/kit/src/plugins/a.ts', `import 'dep-a';\n`);
    put(
      'packages/kit/src/index.ts',
      `export { store } from './store';\nexport const raw = import.meta.glob('./plugins/*.ts', { query: '?raw', import: 'default', eager: true });\n`,
    );
    expect(deps()).toEqual(['@testing-library/react', 'zustand/vanilla']);
  });

  it('reads an import that follows a string holding a glob', () => {
    put(
      'packages/kit/src/store.ts',
      `const pattern = '**/*.ts';\nimport { create } from 'zustand/vanilla';\nconst more = '!**/__tests__/**';\nexport const store = create(() => [pattern, more]);\n`,
    );
    expect(deps()).toEqual(['@testing-library/react', 'zustand/vanilla']);
  });

  it('fails, naming the file, on an import it cannot read', () => {
    put('packages/kit/src/index.ts', `export { store } from './store';\nexport const load = (name: string) => import(\`./locales/\${name}.ts\`);\n`);
    expect(() => deps()).toThrow(/packages\/kit\/src\/index\.ts/);
    put('packages/kit/src/index.ts', `export { store } from './store';\nexport const load = (name: string) => import(name);\n`);
    expect(() => deps()).toThrow(/packages\/kit\/src\/index\.ts/);
    put('packages/kit/src/index.ts', `export { store } from './store';\nconst where = './plugins/*.ts';\nexport const all = import.meta.glob(where);\n`);
    expect(() => deps()).toThrow(/packages\/kit\/src\/index\.ts/);
  });

  it('ignores an import written inside a string or a comment', () => {
    put(
      'packages/kit/src/index.ts',
      [
        `export { store } from './store';`,
        `// import(later)`,
        `export const code = (file: string) => \`() => import(\${JSON.stringify(file)})\`;`,
      ].join('\n'),
    );
    expect(deps()).toEqual(['@testing-library/react', 'zustand/vanilla']);
  });

  it('leaves out what vite cannot or must not pre-bundle', () => {
    put('packages/app/src/raw.ts', `import 'raw-only';\n`);
    put(
      'packages/app/src/Panel.browser.test.tsx',
      [
        `import { expect } from 'vitest';`,
        `import { page } from 'vitest/browser';`,
        `import { commands } from '@vitest/browser/context';`,
        `import '@fixture/kit/style.css';`,
        `import 'some-pkg/theme.css';`,
        `import { readFileSync } from 'node:fs';`,
        `import path from 'path';`,
        `import source from './raw.ts?raw';`,
        `import data from 'virtual:made-up';`,
      ].join('\n'),
    );
    expect(deps()).toEqual([]);
  });
});
