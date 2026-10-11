import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { deadPointers, drawnLeaf, POINTER_ATTRS, pointerTarget } from './pointers';
import { CODE, pointer, SETTINGS } from './workspace.fixtures';

describe('pointers', () => {
  it('names the setting at its path in the dialog', () => {
    expect(pointerTarget(SETTINGS, pointer('view.grid'))).toEqual({ path: 'view.grid', leaf: (SETTINGS.children.view as PrefGroup).children.grid });
  });

  it('draws as its setting', () => {
    expect(drawnLeaf(SETTINGS, pointer('view.grid'))).toMatchObject({ kind: 'boolean', name: 'Show grid', description: 'Draw the grid.' });
  });

  it('draws under its own name where it has one, which is how an override will show', () => {
    expect(drawnLeaf(SETTINGS, pointer('view.grid', 'Lines'))).toMatchObject({ kind: 'boolean', name: 'Lines' });
  });

  it('draws nothing when its setting is gone, and is listed as dead', () => {
    const layout: PrefGroup = { ...CODE, children: { ...CODE.children, lost: pointer('view.nowhere') } };
    expect(drawnLeaf(SETTINGS, pointer('view.nowhere'))).toBeUndefined();
    expect(deadPointers(layout, SETTINGS)).toEqual(['lost']);
  });

  it('offers only its target to edit', () => {
    expect(POINTER_ATTRS).toEqual(['of']);
  });
});
