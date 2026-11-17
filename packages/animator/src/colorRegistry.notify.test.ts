import { describe, expect, it } from 'vitest';
import { ColorOverrideRegistry } from './colorRegistry';

describe('ColorOverrideRegistry notifies', () => {
  it('when an array edited in place is set again', () => {
    const r = new ColorOverrideRegistry();
    const c = [1, 0, 0, 1];
    r.set('n', 'fill', c);
    let calls = 0;
    r.subscribe(() => { calls++; });
    c[0] = 0;
    expect(r.get('n', 'fill')).toEqual([1, 0, 0, 1]);
    r.set('n', 'fill', c);
    expect(calls).toBe(1);
    expect(r.get('n', 'fill')).toEqual([0, 0, 0, 1]);
  });

  it('when a target at a new length drops the colors the old one left painted', () => {
    const r = new ColorOverrideRegistry();
    r.target('n', 'fill', 4).commit([1, 0, 0, 1]);
    expect(r.get('n', 'fill')).toBeDefined();
    let calls = 0;
    r.subscribe(() => { calls++; });
    const version = r.version();
    r.target('n', 'fill', 8);
    expect(r.get('n', 'fill')).toBeUndefined();
    expect(calls).toBe(1);
    expect(r.version()).not.toBe(version);
  });
});
