import { describe, expect, it } from 'vitest';
import { createElementTarget, type StyledElement } from './elementTarget';

function fakeElement(): StyledElement & { style: Record<string, string> } {
  const style: Record<string, string> = {};
  return {
    style: Object.assign(style, { setProperty: (k: string, v: string) => { style[k] = v; } }),
    animate: () => { throw new Error('not here'); },
  } as never;
}

describe('createElementTarget', () => {
  it('refuses `get` without `set`, and `set` without `get`', () => {
    const element = fakeElement();
    const style = (v: number) => ({ opacity: v });
    expect(() => createElementTarget({ element, style, get: () => 0 })).toThrow(/together/);
    expect(() => createElementTarget({ element, style, value: 0, set: () => {} })).toThrow(/together/);
    let kept = 0;
    const t = createElementTarget({ element, style, get: () => kept, set: (v) => { kept = v; } });
    t.commit(3);
    expect(kept).toBe(3);
    expect(t.read()).toBe(3);
  });

  it('shows a value committed while nothing moves it', () => {
    const element = fakeElement();
    const t = createElementTarget({ element, value: 0, style: (v: number) => ({ opacity: v }) });
    t.commit(1);
    expect(t.read()).toBe(1);
    expect(element.style.opacity).toBe('1');
  });
});
