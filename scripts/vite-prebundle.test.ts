import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { bundledDirs, sourcePackages, specifiersIn, specifiersUnder, type Workspace } from './vite-prebundle';

const tree = mkdtempSync(join(tmpdir(), 'vite-prebundle-'));
afterAll(() => rmSync(tree, { recursive: true, force: true }));

function file(path: string, code: string): void {
  mkdirSync(join(tree, path, '..'), { recursive: true });
  writeFileSync(join(tree, path), code);
}

describe('specifiersIn', () => {
  it('finds static, re-exported and dynamic workspace imports, and leaves stylesheets out', () => {
    const code = [
      "import { a } from '@weasel-js/core';",
      "export { b } from '@weasel-js/ui/components/Icon';",
      "const c = await import('@editor/index');",
      "import '@weasel-js/theme/tokens.css';",
      "import React from 'react';",
    ].join('\n');
    expect(specifiersIn(code)).toEqual(['@weasel-js/core', '@weasel-js/ui/components/Icon', '@editor/index']);
  });

  it('takes no specifier out of a template string', () => {
    expect(specifiersIn("const id = import('@weasel-js/labkit${sub}');")).toEqual([]);
  });
});

describe('specifiersUnder', () => {
  // Built from pieces: vite-aliases.test.ts fails on any repo import that resolves to no file.
  const unresolvable = (name: string) => `import { z } from '${'@weasel-js'}/${name}';`;
  file('app/src/main.tsx', "import { x } from '@weasel-js/core';");
  file('app/src/deep/panel.ts', "import { y } from '@weasel-js/geom';");
  file('app/src/main.test.tsx', unresolvable('testing-only'));
  file('app/src/Panel.stories.tsx', unresolvable('story-only'));
  file('app/node_modules/dep/index.js', unresolvable('vendored'));

  it('reads shipped source only, skipping tests, stories and node_modules', () => {
    expect([...specifiersUnder([join(tree, 'app')])].sort()).toEqual(['@weasel-js/core', '@weasel-js/geom']);
  });

  it('reads stories too when asked', () => {
    expect([...specifiersUnder([join(tree, 'app')], true)].sort()).toEqual([
      '@weasel-js/core',
      '@weasel-js/geom',
      '@weasel-js/story-only',
    ]);
  });
});

const ws: Workspace = {
  dirs: new Map([
    ['@weasel-js/geom', '/repo/packages/geom'],
    ['@weasel-js/core', '/repo/packages/core'],
    ['@weasel-js/ui', '/repo/packages/ui'],
    ['@weasel-js/labkit', '/repo/packages/labkit'],
  ]),
  deps: new Map([
    ['@weasel-js/geom', []],
    ['@weasel-js/core', ['@weasel-js/geom']],
    ['@weasel-js/ui', ['@weasel-js/core']],
    ['@weasel-js/labkit', ['@weasel-js/ui', '@weasel-js/core']],
  ]),
};

describe('sourcePackages', () => {
  it('serves no package from source for an app whose own trees hold none', () => {
    expect(sourcePackages(ws, ['/repo/apps/chart/src'])).toEqual(new Set());
  });

  it('serves a package holding a source tree, and every package that depends on it', () => {
    expect(sourcePackages(ws, ['/repo/packages/ui/src'])).toEqual(new Set(['@weasel-js/ui', '@weasel-js/labkit']));
  });
});

describe('bundledDirs', () => {
  it('bundles every package and every shared app source', () => {
    expect(bundledDirs('/repo', ['/repo/apps/chart/src', '/repo/apps/shared'], ws, new Set())).toEqual([
      '/repo/packages/geom',
      '/repo/packages/core',
      '/repo/packages/ui',
      '/repo/packages/labkit',
      '/repo/apps/draw/src',
      '/repo/apps/shared/editor/src',
    ]);
  });

  it('leaves out the app itself and the packages served from source', () => {
    const dirs = bundledDirs('/repo', ['/repo/apps/draw/src'], ws, new Set(['@weasel-js/ui', '@weasel-js/labkit']));
    expect(dirs).toEqual(['/repo/packages/geom', '/repo/packages/core', '/repo/apps/shared/editor/src']);
  });
});
