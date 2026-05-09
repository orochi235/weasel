import { describe, it, expect } from 'vitest';
import { GroupState } from './GroupState';
import { mat3 } from './mat3';

describe('GroupState', () => {
  it('starts at identity transform and alpha=1', () => {
    const s = new GroupState();
    expect(Array.from(s.transform)).toEqual(Array.from(mat3.identity()));
    expect(s.alpha).toBe(1);
  });

  it('push() composes transform and multiplies alpha', () => {
    const s = new GroupState();
    s.push({ transform: mat3.translate(mat3.identity(), 10, 20), alpha: 0.5 });
    const [x, y] = mat3.apply(s.transform, 0, 0);
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(s.alpha).toBe(0.5);
  });

  it('nested push composes both levels', () => {
    const s = new GroupState();
    s.push({ transform: mat3.translate(mat3.identity(), 10, 0), alpha: 0.5 });
    s.push({ transform: mat3.translate(mat3.identity(), 0, 20), alpha: 0.5 });
    const [x, y] = mat3.apply(s.transform, 0, 0);
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(s.alpha).toBe(0.25);
  });

  it('pop() restores previous transform and alpha', () => {
    const s = new GroupState();
    const before = Array.from(s.transform);
    s.push({ transform: mat3.translate(mat3.identity(), 10, 20), alpha: 0.5 });
    s.pop();
    expect(Array.from(s.transform)).toEqual(before);
    expect(s.alpha).toBe(1);
  });

  it('omitting transform/alpha in push() leaves them unchanged', () => {
    const s = new GroupState();
    s.push({ alpha: 0.5 });
    expect(Array.from(s.transform)).toEqual(Array.from(mat3.identity()));
    expect(s.alpha).toBe(0.5);
    s.pop();
    s.push({ transform: mat3.translate(mat3.identity(), 5, 5) });
    expect(s.alpha).toBe(1);
  });

  it('pop() at the root throws (helps catch unbalanced renderer code)', () => {
    const s = new GroupState();
    expect(() => s.pop()).toThrow();
  });
});
