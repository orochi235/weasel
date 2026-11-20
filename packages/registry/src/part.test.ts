import { describe, expect, it, vi } from 'vitest';
import { createPart, identityKeyOf } from './part';

describe('createPart', () => {
  it('makes each owner its part once', () => {
    const make = vi.fn((owner: { id: string }) => ({ of: owner.id }));
    const partOf = createPart(make);
    const a = { id: 'a' };
    const first = partOf(a);
    expect(partOf(a)).toBe(first);
    expect(first).toEqual({ of: 'a' });
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('gives different owners different parts', () => {
    const partOf = createPart((owner: object) => ({ owner }));
    const a = {};
    const b = {};
    expect(partOf(a)).not.toBe(partOf(b));
    expect(partOf(b).owner).toBe(b);
  });

  it('keeps a part that is undefined instead of making it again', () => {
    const make = vi.fn((): undefined => undefined);
    const partOf = createPart(make);
    const a = {};
    partOf(a);
    partOf(a);
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('makes nothing for an owner whose make throws, so the next read tries again', () => {
    let fail = true;
    const partOf = createPart(() => {
      if (fail) throw new Error('not yet');
      return 1;
    });
    const a = {};
    expect(() => partOf(a)).toThrow('not yet');
    fail = false;
    expect(partOf(a)).toBe(1);
  });
});

describe('identityKeyOf', () => {
  it('names an object by identity and a primitive by type and value', () => {
    const a = {};
    expect(identityKeyOf(a)).toBe(identityKeyOf(a));
    expect(identityKeyOf(a)).not.toBe(identityKeyOf({}));
    expect(identityKeyOf(1)).toBe(identityKeyOf(1));
    expect(identityKeyOf(1)).not.toBe(identityKeyOf('1'));
    expect(identityKeyOf(null)).not.toBe(identityKeyOf(undefined));
  });

  it('names each symbol by identity, and a registered one by its registry key', () => {
    const a = Symbol('x');
    expect(identityKeyOf(a)).toBe(identityKeyOf(a));
    expect(identityKeyOf(a)).not.toBe(identityKeyOf(Symbol('x')));
    expect(identityKeyOf(Symbol())).not.toBe(identityKeyOf(Symbol()));
    expect(identityKeyOf(Symbol.for('x'))).toBe(identityKeyOf(Symbol.for('x')));
    expect(identityKeyOf(Symbol.for('x'))).not.toBe(identityKeyOf('x'));
  });
});
