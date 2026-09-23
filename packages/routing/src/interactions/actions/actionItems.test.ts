import { describe, it, expect } from 'vitest';
import { actionItems } from './actionItems';
import type { Action } from './action';

const run = () => {};

describe('actionItems', () => {
  it('is the action itself when it declares no variants', () => {
    const a: Action = { id: 'undo', label: 'Undo', invoker: { timing: 'immediate', run } };
    expect(actionItems(a).map((i) => [i.key, i.label, i.params])).toEqual([['undo', 'Undo', undefined]]);
  });

  it('is one entry per variant, keyed id:variant, carrying its params', () => {
    const a: Action = {
      id: 'flip',
      label: 'Flip',
      invoker: { timing: 'immediate', run },
      variants: [
        { key: 'x', label: 'Flip Horizontal', params: { axis: 'x' } },
        { key: 'y', label: 'Flip Vertical', params: { axis: 'y' } },
      ],
    };
    expect(actionItems(a).map((i) => [i.key, i.label, i.params])).toEqual([
      ['flip:x', 'Flip Horizontal', { axis: 'x' }],
      ['flip:y', 'Flip Vertical', { axis: 'y' }],
    ]);
  });

  it('is nothing for an action a trigger cannot start', () => {
    const drag = {
      id: 'slice',
      label: 'Slice',
      invoker: { timing: 'ongoing', start: () => ({}) },
    } as unknown as Action;
    expect(actionItems(drag)).toEqual([]);
    expect(actionItems({ id: 'bare', label: 'Bare' })).toEqual([]);
  });
});
