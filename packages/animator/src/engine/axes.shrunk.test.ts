import { describe, expect, it } from 'vitest';
import { axesOf } from './axes';
import { sampleTrack } from '../timeline/sampleTrack';

describe('axesOf, shrunk from the property tests', () => {
  it('keeps an own `__proto__` field, as JSON.parse makes one', () => {
    const v = JSON.parse('{"__proto__":0}') as Record<string, number>;
    const axes = axesOf(v)!;
    expect(axes.from(axes.to(v))).toEqual(v);
    expect(Object.hasOwn(axes.from([3]), '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(axes.from([3]))).toBe(Object.prototype);
  });

  it('samples a track of such values with the field kept', () => {
    const keys = JSON.parse('[{"t":0,"value":{"__proto__":0,"x":0}},{"t":10,"value":{"__proto__":10,"x":20}}]');
    const mid = sampleTrack({ kind: 'sampled', keys }, 5) as Record<string, number>;
    expect(Object.hasOwn(mid, '__proto__')).toBe(true);
    expect(mid).toEqual(JSON.parse('{"__proto__":5,"x":10}'));
  });
});
