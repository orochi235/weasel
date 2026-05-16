import { describe, it, expect } from 'vitest';
import { defaultBooleanActions } from './booleans';
import type { BooleansAdapter } from '../booleans/booleans';
import { asNodeId } from 'core/scene/types';

function makeAdapter(): BooleansAdapter {
  return {
    getSelection: () => [asNodeId('a'), asNodeId('b')],
    getWorldPath: () => undefined,
    compareZ: () => 0,
    createPathNode: () => ({ id: 'new' }),
  };
}

describe('defaultBooleanActions', () => {
  it('returns 6 actions with documented ids', () => {
    const acts = defaultBooleanActions(makeAdapter());
    expect(acts.map((a) => a.id).sort()).toEqual([
      'pathfinder.crop',
      'pathfinder.divide',
      'pathfinder.exclude',
      'pathfinder.intersect',
      'pathfinder.subtract',
      'pathfinder.union',
    ]);
  });

  it('every action ships a default icon', () => {
    const acts = defaultBooleanActions(makeAdapter());
    for (const a of acts) expect(a.icon).toBeDefined();
  });
});
