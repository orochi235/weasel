// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { indexExports } from './exportInfo.ts';

describe('indexExports', () => {
  it('leaves out a symbol the source does not export', () => {
    expect(indexExports({ '/a.ts': 'function foo() { return 1; }\n' }).foo).toBeUndefined();
  });

  it('finds an exported function with no JSDoc', () => {
    expect(indexExports({ '/a.ts': 'export function bar() { return 1; }\n' }).bar).toEqual({ path: '/a.ts', line: 1, jsdoc: null });
  });

  it('captures a JSDoc block immediately preceding the export', () => {
    const src = ['/** Adds one to its argument. */', 'export function addOne(x: number) { return x + 1; }', ''].join('\n');
    expect(indexExports({ '/a.ts': src }).addOne).toEqual({ path: '/a.ts', line: 2, jsdoc: 'Adds one to its argument.' });
  });

  it('captures a multi-line JSDoc block', () => {
    const src = ['/**', ' * Multi-line.', ' * Description.', ' */', 'export const Thing = 1;'].join('\n');
    expect(indexExports({ '/a.ts': src }).Thing!.jsdoc).toBe('Multi-line.\nDescription.');
  });

  it("prefers a declaration over a barrel's export list, whichever file sorts first", () => {
    const index = indexExports({
      '/a/index.ts': "export { thing, other as renamed, type Shape } from './thing';",
      '/b/thing.ts': 'export const thing = 1;',
    });
    expect(index.thing!.path).toBe('/b/thing.ts');
    expect(index.renamed!.path).toBe('/a/index.ts');
    expect(index.Shape!.path).toBe('/a/index.ts');
  });

  it('indexes an export named like an Object.prototype member', () => {
    expect(indexExports({ '/a.ts': 'export const constructor = 1;' }).constructor).toEqual({ path: '/a.ts', line: 1, jsdoc: null });
  });
});
