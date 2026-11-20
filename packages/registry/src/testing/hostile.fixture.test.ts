import { describe, expect, it } from 'vitest';
import { mutate } from './hostile.fixture';

describe('mutate', () => {
  it('duplicates a field or a root holding undefined', () => {
    expect(mutate({ a: undefined, b: 1 }, ['a'], { op: 'duplicate' })).toEqual({ a: [undefined, undefined], b: 1 });
    expect(mutate(undefined, [], { op: 'duplicate' })).toEqual([undefined, undefined]);
  });
});
