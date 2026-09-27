import { describe, it, expect } from 'vitest';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
import {
  FEATURE_ACTION_IDS,
  TOOL_DRIVEN_ACTION_IDS,
  SCENE_CANVAS_FEATURES,
  resolveFeatures,
  featureActionIds,
} from './features';

describe('FEATURE_ACTION_IDS', () => {
  it('places every kit-standard action under exactly one preset, or leaves it to its tools', () => {
    const owners = new Map<string, string[]>();
    for (const [feature, ids] of Object.entries(FEATURE_ACTION_IDS)) {
      for (const id of ids) owners.set(id, [...(owners.get(id) ?? []), feature]);
    }
    for (const id of TOOL_DRIVEN_ACTION_IDS) owners.set(id, [...(owners.get(id) ?? []), 'tool']);

    for (const id of KIT_STANDARD_ACTION_IDS) {
      expect(owners.get(id), id).toHaveLength(1);
    }
    // No preset names an action the kit does not ship.
    expect([...owners.keys()].filter((id) => !KIT_STANDARD_ACTION_IDS.includes(id))).toEqual([]);
  });
});

describe('resolveFeatures', () => {
  it('is empty for a bare canvas', () => {
    expect([...resolveFeatures(undefined)]).toEqual([]);
    expect([...resolveFeatures([])]).toEqual([]);
  });

  it('expands draw to every other preset', () => {
    const all = SCENE_CANVAS_FEATURES.filter((f) => f !== 'draw');
    expect([...resolveFeatures(['draw'])].sort()).toEqual([...all].sort());
  });

  it('adds view when a viewport config is passed', () => {
    expect([...resolveFeatures(['pick'], { viewport: true })].sort()).toEqual(['pick', 'view']);
  });

  it('composes presets independently', () => {
    const ids = featureActionIds(resolveFeatures(['move', 'arrange']));
    expect(ids.has('move')).toBe(true);
    expect(ids.has('align.left')).toBe(true);
    expect(ids.has('delete')).toBe(false);
    expect(ids.has('areaSelect')).toBe(false);
  });
});
