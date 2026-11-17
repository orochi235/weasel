import { describe, expect, it } from 'vitest';
import { TrimOverrideRegistry } from './trimRegistry';

describe('TrimOverrideRegistry.set with no edge', () => {
  it('paints nothing, and has() says so', () => {
    const r = new TrimOverrideRegistry();
    r.set('a', {});
    r.set('b', { start: undefined });
    expect(r.has('a')).toBe(false);
    expect(r.has('b')).toBe(false);
    expect(r.resolve('a')).toBeUndefined();
  });

  it('drops an override it is set over, telling subscribers once', () => {
    const r = new TrimOverrideRegistry();
    r.set('a', { start: 0.2 });
    let calls = 0;
    r.subscribe(() => { calls++; });
    r.set('a', {});
    expect(r.has('a')).toBe(false);
    expect(calls).toBe(1);
    r.set('a', {});
    expect(calls).toBe(1);
  });
});
