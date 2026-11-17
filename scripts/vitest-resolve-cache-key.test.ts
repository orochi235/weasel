// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bareImportKey, packageOf } from './vitest-resolve-cache-key.ts';

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'resolve-cache-key-')));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const install = (dir: string, pkg: string) => {
  mkdirSync(join(root, dir, 'node_modules', pkg), { recursive: true });
  writeFileSync(join(root, dir, 'node_modules', pkg, 'package.json'), '{}');
};

describe('bareImportKey', () => {
  it('changes when a nested copy of an imported package moves aside and back', () => {
    install('', 'opentype.js');
    install('packages/font', 'opentype.js');
    mkdirSync(join(root, 'packages/font/src'), { recursive: true });
    const file = join(root, 'packages/font/src/parser.ts');
    const code = "const ot = await import('opentype.js');\n";
    const key = () => bareImportKey(file, code);
    const nested = key();
    const nestedDir = join(root, 'packages/font/node_modules');
    renameSync(join(nestedDir, 'opentype.js'), join(nestedDir, '.opentype.js-aside'));
    expect(key()).not.toBe(nested);
    renameSync(join(nestedDir, '.opentype.js-aside'), join(nestedDir, 'opentype.js'));
    expect(key()).toBe(nested);
  });

  it('reads every import form and leaves out relative, node: and aliased specifiers', () => {
    install('', 'a');
    install('', '@s/b');
    install('', 'c');
    install('', 'd');
    const code = [
      "import x from 'a/sub';", "export * from '@s/b';", "require('c');", "import 'd';",
      "import y from './y';", "import fs from 'node:fs';", "import z from '@weasel-js/core';",
    ].join('\n');
    const key = bareImportKey(join(root, 'f.ts'), code, [{ find: /^@weasel-js\/(.*)$/, replacement: '/src/$1' }]);
    expect(key.split('\0')).toEqual(['@s/b', 'a', 'c', 'd'].map((p) => join(root, 'node_modules', p)));
  });
});

describe('packageOf', () => {
  it('names the package of a bare specifier and nothing else', () => {
    expect(packageOf('@scope/name/deep')).toBe('@scope/name');
    expect(packageOf('name/deep')).toBe('name');
    expect(packageOf('./x')).toBeNull();
    expect(packageOf('node:fs')).toBeNull();
    expect(packageOf('virtual:x')).toBeNull();
    expect(packageOf('\0x')).toBeNull();
  });
});
