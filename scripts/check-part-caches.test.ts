import { describe, expect, it } from 'vitest';
import { partCacheLines } from './check-part-caches.mjs';

describe('partCacheLines', () => {
  it('catches a module-level WeakMap that is read and written', () => {
    const source = [
      'const parts = new WeakMap<object, number>();',
      'export function partOf(o: object) {',
      '  let p = parts.get(o);',
      '  if (p === undefined) parts.set(o, (p = 1));',
      '  return p;',
      '}',
    ].join('\n');
    expect(partCacheLines(source)).toEqual([1]);
  });

  it('catches an exported or annotated one', () => {
    expect(partCacheLines('export const a: WeakMap<object, 1> = new WeakMap();\na.get(x); a.set(x, 1);')).toEqual([1]);
  });

  it('leaves a map that is only written, or only read, alone', () => {
    expect(partCacheLines('const a = new WeakMap();\na.set(x, 1);')).toEqual([]);
    expect(partCacheLines('const a = new WeakMap();\na.get(x);')).toEqual([]);
  });

  it('leaves a WeakMap made inside a function alone', () => {
    expect(partCacheLines('function f() {\n  const a = new WeakMap();\n  a.get(x); a.set(x, 1);\n}')).toEqual([]);
  });
});
