import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { bundledDirs, specifiersIn, specifiersUnder } from './vite-prebundle';

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
});

describe('specifiersUnder', () => {
  it('reads shipped source only, skipping tests, stories and node_modules', () => {
    file('app/src/main.tsx', "import { x } from '@weasel-js/core';");
    file('app/src/deep/panel.ts', "import { y } from '@weasel-js/geom';");
    // Built from pieces: vite-aliases.test.ts fails on any repo import that resolves to no file.
    const unresolvable = (name: string) => `import { z } from '${'@weasel-js'}/${name}';`;
    file('app/src/main.test.tsx', unresolvable('testing-only'));
    file('app/src/Panel.stories.tsx', unresolvable('forge'));
    file('app/node_modules/dep/index.js', unresolvable('vendored'));
    expect([...specifiersUnder([join(tree, 'app')])].sort()).toEqual(['@weasel-js/core', '@weasel-js/geom']);
  });
});

describe('bundledDirs', () => {
  const repo = resolve('/repo');

  it('bundles every package and every shared app source', () => {
    expect(bundledDirs(repo, ['/repo/apps/chart/src', '/repo/apps/shared'])).toEqual([
      '/repo/packages',
      '/repo/apps/draw/src',
      '/repo/apps/shared/editor/src',
    ]);
  });

  it('leaves out an app source that is the app itself', () => {
    expect(bundledDirs(repo, ['/repo/apps/draw/src', '/repo/apps/shared'])).not.toContain('/repo/apps/draw/src');
  });
});
