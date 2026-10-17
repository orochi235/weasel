import { describe, it, expect } from 'vitest';
import { actionItems, actionItemTitle } from './actionItems';
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

describe('actionItemTitle', () => {
  const titles = (label: string, variants?: string[]) =>
    actionItems({
      id: 'a',
      label,
      invoker: { timing: 'immediate', run },
      variants: variants?.map((v) => ({ key: v, label: v, params: {} })),
    }).map(actionItemTitle);

  it('is the action label when there is no variant', () => {
    expect(titles('Undo')).toEqual(['Undo']);
  });

  it('names the action before a variant', () => {
    expect(titles('New', ['A4', 'Legal'])).toEqual(['New: A4', 'New: Legal']);
  });

  it('leaves a variant that already opens with the action label, in any case', () => {
    expect(titles('Zoom', ['Zoom In', 'zoom out', 'Reset'])).toEqual(['Zoom In', 'zoom out', 'Zoom: Reset']);
    expect(titles('Zoom', ['Reset Zoom', 'Zoom'])).toEqual(['Reset Zoom', 'Zoom']);
    expect(titles('Flip', ['Flip Horizontal'])).toEqual(['Flip Horizontal']);
    expect(titles('Bring Forward', ['Bring Forward'])).toEqual(['Bring Forward']);
  });

  it('prefixes a variant that only shares the action label\'s letters', () => {
    expect(titles('Zoom', ['Zoomed out'])).toEqual(['Zoom: Zoomed out']);
    expect(titles('Zoom', ['Unzoom'])).toEqual(['Zoom: Unzoom']);
  });
});
