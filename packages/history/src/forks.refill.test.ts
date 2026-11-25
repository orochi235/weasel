import { describe, expect, it } from 'vitest';
import { refill } from './forks';

describe('refilling a stack', () => {
  it('takes more entries than a call takes arguments', () => {
    const source = Array.from({ length: 3_000_000 }, (_, i) => i);
    const target = [7, 8];
    refill(target, source);
    expect(target.length).toBe(source.length);
    expect(target[2_999_999]).toBe(2_999_999);
  });

  it('drops what it held past the new length', () => {
    const target = [1, 2, 3];
    refill(target, [9]);
    expect(target).toEqual([9]);
  });
});
