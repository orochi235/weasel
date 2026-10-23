/** Which node Enter opens in path-edit, from what is selected. */
import { describe, expect, it } from 'vitest';
import {
  asNodeId, createScene, PATH_EFFECT_DERIVATIONS, pathEffectNode, pathFromD, withPathEffectsRegistry,
} from '@weasel-js/core';
import type { DrawScene } from '../drawDocument';
import { pathToEdit } from './useCanvasModes';

function scene(hideSources: boolean): DrawScene {
  return createScene({
    systemLayers: [{ id: 'default' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: asNodeId('t'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 80, height: 20 }, data: { text: 'Hi' } },
      { id: asNodeId('p'), kind: 'mark', layer: 'default', pose: { x: 0, y: 50, width: 100, height: 1 }, data: { path: pathFromD('M0 50 L100 50') } },
      { ...pathEffectNode({ kind: 'textAlong', ...(hideSources ? { hideSources } : {}) }, [asNodeId('t'), asNodeId('p')], 'default', PATH_EFFECT_DERIVATIONS), id: asNodeId('fx') },
    ],
  } as never) as unknown as DrawScene;
}

describe('pathToEdit', () => {
  it('opens a selected path itself', () => {
    expect(pathToEdit(scene(true), ['p'])).toBe('p');
  });

  it('opens the path a selected effect hides', () => {
    expect(pathToEdit(scene(true), ['fx'])).toBe('p');
  });

  it('opens nothing for an effect whose path is in view, or for text', () => {
    expect(pathToEdit(scene(false), ['fx'])).toBeNull();
    expect(pathToEdit(scene(true), ['t'])).toBeNull();
  });

  it('opens nothing for several selected', () => {
    expect(pathToEdit(scene(true), ['p', 'fx'])).toBeNull();
  });
});
