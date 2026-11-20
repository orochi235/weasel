import { describe, expect, it } from 'vitest';
import { mutate, prototypePolluted } from './hostile.fixture';

describe('mutate', () => {
  it('duplicates a field or a root holding undefined', () => {
    expect(mutate({ a: undefined, b: 1 }, ['a'], { op: 'duplicate' })).toEqual({ a: [undefined, undefined], b: 1 });
    expect(mutate(undefined, [], { op: 'duplicate' })).toEqual([undefined, undefined]);
  });
});

describe('prototypePolluted', () => {
  it('sees a member overwritten or a symbol added, and nothing once each is undone', () => {
    const proto = Object.prototype as unknown as Record<PropertyKey, unknown>;
    const toString = Object.getOwnPropertyDescriptor(Object.prototype, 'toString')!;
    expect(prototypePolluted()).toBe(false);
    try {
      proto.toString = () => 'junk';
      expect(prototypePolluted()).toBe(true);
    } finally {
      Object.defineProperty(Object.prototype, 'toString', toString);
    }
    expect(prototypePolluted()).toBe(false);
    const key = Symbol('polluted');
    try {
      proto[key] = 1;
      expect(prototypePolluted()).toBe(true);
    } finally {
      delete proto[key];
    }
    expect(prototypePolluted()).toBe(false);
  });
});
