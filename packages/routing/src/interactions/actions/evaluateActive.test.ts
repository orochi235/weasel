import { describe, it, expect } from 'vitest';
import type { Action } from './action';
import { evaluateActive } from './actionEnabled';

const action = (active?: Action['active']): Action => ({
  id: 'text.bold',
  label: 'Bold',
  invoker: { timing: 'immediate', run: () => {} },
  ...(active ? { active } : {}),
});

describe('evaluateActive', () => {
  it('is undefined for an action with no pressed state, which is not off', () => {
    expect(evaluateActive(action())).toBeUndefined();
  });

  it('reads the predicate, handing it the deps', () => {
    const deps = { held: true } as never;
    expect(evaluateActive(action((d) => (d as unknown as { held: boolean }).held), deps)).toBe(true);
    expect(evaluateActive(action(() => false))).toBe(false);
  });

  it('reads a predicate that throws as not active', () => {
    expect(evaluateActive(action(() => { throw new Error('no selection'); }))).toBe(false);
  });
});
