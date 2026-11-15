import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rewriteDeclaration } from './dts-extensions.mjs';

let dist: string;

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'dts-extensions-'));
  mkdirSync(join(dist, 'Button'));
  for (const file of ['Button/index.d.ts', 'Button/Button.d.ts', 'icons.table.d.ts', 'queue.d.ts']) {
    writeFileSync(join(dist, file), '');
  }
});

afterEach(() => rmSync(dist, { recursive: true, force: true }));

describe('rewriteDeclaration', () => {
  it('names the .js file or directory index of every relative specifier', () => {
    const text = [
      "export { Button } from './Button';",
      "export type { ButtonProps } from './Button/Button';",
      "import { type Q } from './queue';",
      "export * from './icons.table';",
      "export declare const q: import('./queue').Q;",
      "import type { X } from '@weasel-js/core';",
      "export { Y } from './queue.js';",
      '',
    ].join('\n');
    const { text: out, unresolved } = rewriteDeclaration(join(dist, 'index.d.ts'), text);
    expect(unresolved).toEqual([]);
    expect(out).toBe([
      "export { Button } from './Button/index.js';",
      "export type { ButtonProps } from './Button/Button.js';",
      "import { type Q } from './queue.js';",
      "export * from './icons.table.js';",
      "export declare const q: import('./queue.js').Q;",
      "import type { X } from '@weasel-js/core';",
      "export { Y } from './queue.js';",
      '',
    ].join('\n'));
  });

  it('drops a side-effect asset import and leaves comments alone', () => {
    const text = "import { type Q } from './queue';\nimport './toast.css';\n/** See import('./nowhere'). */\nexport type R = Q;\n";
    const { text: out, unresolved } = rewriteDeclaration(join(dist, 'index.d.ts'), text);
    expect(unresolved).toEqual([]);
    expect(out).toBe("import { type Q } from './queue.js';\n\n/** See import('./nowhere'). */\nexport type R = Q;\n");
  });

  it('reports a relative specifier no declaration answers', () => {
    expect(rewriteDeclaration(join(dist, 'index.d.ts'), "export * from './missing';\n").unresolved).toEqual(['./missing']);
  });
});
