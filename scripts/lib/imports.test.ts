import { describe, expect, it } from 'vitest';
import { importSpecifiers, isBare, namedSpecifiers, packageOf } from './imports.mjs';

describe('importSpecifiers', () => {
  it('reads imports, re-exports, side-effect imports, dynamic imports and require', () => {
    const source = [
      "import { a } from './a.js';",
      "import b from 'b';",
      "import './chunk-X.js';",
      "export { c } from './c.js';",
      "export * from '@scope/d';",
      "const e = await import('./e.js');",
      "const f = require('f');",
      "const g = import('./g.css?raw');",
    ].join('\n');
    expect(importSpecifiers(source, 'm.js')).toEqual([
      './a.js',
      'b',
      './chunk-X.js',
      './c.js',
      '@scope/d',
      './e.js',
      'f',
      './g.css?raw',
    ]);
  });

  it('erases type-only imports and re-exports', () => {
    const source = [
      "import type { A } from 'a';",
      "import { type B, type C } from 'bc';",
      "import { type D, E } from 'de';",
      "export type { F } from 'f';",
      "export type * from 'g';",
      "export { type H } from 'h';",
      "import 'side';",
    ].join('\n');
    expect(importSpecifiers(source, 'm.ts')).toEqual(['de', 'side']);
    expect(namedSpecifiers(source, 'm.ts')).toEqual(['a', 'bc', 'de', 'f', 'g', 'h', 'side']);
  });

  it('ignores import-shaped text inside strings, templates and comments', () => {
    const source = [
      'const code = `import { useState } from "react";`;',
      "const msg = \"export { x } from 'react-dom'\";",
      "// import x from 'react';",
      "/* const y = require('react'); */",
      "if (spec.type !== 'import') throw new Error(\"from 'nowhere'\");",
      'const z = { from: "somewhere" };',
    ].join('\n');
    expect(importSpecifiers(source, 'm.js')).toEqual([]);
    expect(namedSpecifiers(source, 'm.js')).toEqual([]);
  });

  it('skips a dynamic import or require whose argument is not a literal', () => {
    const source = "const a = import(name); const b = require(`./${x}`); const c = import(`./c.js`);";
    expect(importSpecifiers(source, 'm.js')).toEqual(['./c.js']);
  });

  it('parses JSX by the file name', () => {
    const source = "import { X } from 'x';\nexport const Y = () => <X a=\"import('nope')\" />;";
    expect(importSpecifiers(source, 'm.tsx')).toEqual(['x']);
  });

  it('keeps offsets right after non-ASCII text', () => {
    const source = "const s = '→ ✓ 日本';\nconst m = import('./m.js');";
    expect(importSpecifiers(source, 'm.js')).toEqual(['./m.js']);
  });

  it('names the file when it does not parse', () => {
    expect(() => importSpecifiers('import { from', 'broken.ts')).toThrow(/broken\.ts/);
  });
});

describe('packageOf / isBare', () => {
  it('reduces a specifier to its package', () => {
    expect(packageOf('@scope/name/sub')).toBe('@scope/name');
    expect(packageOf('name/sub')).toBe('name');
  });

  it('tells a package specifier from a path or a protocol', () => {
    expect(isBare('react')).toBe(true);
    expect(isBare('@weasel-js/core/math')).toBe(true);
    expect(isBare('./a')).toBe(false);
    expect(isBare('node:fs')).toBe(false);
    expect(isBare('virtual:demo')).toBe(false);
  });
});
