import { describe, expect, it } from 'vitest';
import { parseTransform } from './transform';
import { IDENTITY_MATRIX } from './types';

function read(attr: string): { m: readonly number[]; warnings: string[] } {
  const warnings: string[] = [];
  return { m: parseTransform(attr, (w) => warnings.push(w)), warnings };
}

describe('parseTransform', () => {
  it('composes a valid list, commas and whitespace between functions and arguments', () => {
    expect(read('translate(10, 20) scale(2)').m).toEqual([2, 0, 0, 2, 10, 20]);
    expect(read('translate(10 20),scale(2 3)').m).toEqual([2, 0, 0, 3, 10, 20]);
    expect(read('matrix(1,0,0,1,5,6)').warnings).toEqual([]);
  });

  it('reads arguments a minifier wrote with no separator where the sign or point starts a number', () => {
    expect(read('translate(10-20)')).toEqual({ m: [1, 0, 0, 1, 10, -20], warnings: [] });
    expect(read('translate(.5.5)').m).toEqual([1, 0, 0, 1, 0.5, 0.5]);
    expect(read('matrix(1 0 0 1-5 1e1)').m).toEqual([1, 0, 0, 1, -5, 10]);
    expect(read('translate(10,,20)').m).toEqual(IDENTITY_MATRIX);
    expect(read('translate(,10)').m).toEqual(IDENTITY_MATRIX);
  });

  it('reads nothing, or none, as the identity without a warning', () => {
    expect(read('').m).toEqual(IDENTITY_MATRIX);
    expect(read('  none ')).toEqual({ m: IDENTITY_MATRIX, warnings: [] });
  });

  it('ignores a whole list holding a function it cannot read, as a browser does', () => {
    for (const bad of [
      'translate(10) matrix(1 0 0 1 5)',
      'translate(10) foo(3) scale(2)',
      'translate(10) scale()',
      'rotate(30 5)',
      'skewX(10 20)',
      'translate(10) junk',
      'translate(10px)',
      'scale(1, 2, 3)',
    ]) {
      const { m, warnings } = read(bad);
      expect(m, bad).toEqual(IDENTITY_MATRIX);
      expect(warnings, bad).toHaveLength(1);
    }
  });

  it('names an unknown function, and only that, as unsupported', () => {
    expect(read('foo(3)').warnings[0]).toMatch(/unsupported transform function: foo/);
    expect(read('matrix(1 0 0 1 5)').warnings[0]).not.toMatch(/unsupported/);
  });
});
