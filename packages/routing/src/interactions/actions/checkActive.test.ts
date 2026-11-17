import { describe, it, expect } from 'vitest';
import type { Action } from './action';
import { checkActive } from './actionEnabled';

const action = (active?: Action['active']): Action => ({
  id: 'text.bold',
  label: 'Bold',
  invoker: { timing: 'immediate', run: () => {} },
  ...(active ? { active } : {}),
});

describe('checkActive', () => {
  it('is undefined for an action with no pressed state, which is not off', () => {
    expect(checkActive(action())).toBeUndefined();
  });

  it('reads the predicate, handing it the deps', () => {
    const deps = { held: true } as never;
    expect(checkActive(action((d) => (d as unknown as { held: boolean }).held), deps)).toBe(true);
    expect(checkActive(action(() => false))).toBe(false);
  });

  it('reads a predicate that throws as not active', () => {
    expect(checkActive(action(() => { throw new Error('no selection'); }))).toBe(false);
  });
});
