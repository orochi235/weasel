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
});
