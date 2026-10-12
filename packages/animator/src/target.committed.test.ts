import { describe, expect, it } from 'vitest';
import { createTarget } from './target';

describe('a target’s committed value', () => {
  it('is read and written through the target, under whatever is moving it', () => {
    let value = { x: 1, y: 2 };
    const target = createTarget({ get: () => value, set: (v) => { value = v; } });
    expect(target.committed()).toEqual({ x: 1, y: 2 });
    target.commit({ x: 5, y: 6 });
    expect(value).toEqual({ x: 5, y: 6 });
    expect(target.read()).toEqual({ x: 5, y: 6 });
  });

  it('carries the axes it was made with', () => {
    const axes = { count: 1, to: (v: { n: number }) => [v.n], from: (a: ArrayLike<number>) => ({ n: a[0]! }) };
    const target = createTarget({ get: () => ({ n: 3 }), set: () => {}, axes });
    expect(target.axes).toBe(axes);
    expect(createTarget({ get: () => 4, set: () => {} }).axes.to(7)).toEqual([7]);
  });
});
