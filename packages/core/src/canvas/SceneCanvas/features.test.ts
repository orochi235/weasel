import { describe, it, expect } from 'vitest';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
import {
  FEATURE_ACTION_IDS,
  TOOL_DRIVEN_ACTION_IDS,
  SCENE_CANVAS_FEATURES,
  COMPOSITE_FEATURES,
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

  it('expands draw to every preset no other one abbreviates', () => {
    const all = SCENE_CANVAS_FEATURES.filter((f) => !(f in COMPOSITE_FEATURES));
    expect([...resolveFeatures(['draw'])].sort()).toEqual([...all].sort());
  });

  it('adds view when a viewport config is passed', () => {
    expect([...resolveFeatures(['outline'], { viewport: true })].sort()).toEqual(['outline', 'view']);
  });

  it('expands pick to select + outline and transform to resize + rotate', () => {
    expect([...resolveFeatures(['pick'])].sort()).toEqual(['outline', 'select']);
    expect([...resolveFeatures(['transform'])].sort()).toEqual(['resize', 'rotate']);
  });

  it('registers resize without rotate', () => {
    const ids = featureActionIds(resolveFeatures(['resize']));
    expect(ids.has('resize')).toBe(true);
    expect(ids.has('rotate')).toBe(false);
  });

  it('gives edit the paste-event action, apart from ingest', () => {
    const ids = featureActionIds(resolveFeatures(['edit']));
    expect(ids.has('clipboard.pasteEvent')).toBe(true);
    expect(ids.has('ingest')).toBe(false);
  });

  it('composes presets independently', () => {
    const ids = featureActionIds(resolveFeatures(['move', 'arrange']));
    expect(ids.has('move')).toBe(true);
    expect(ids.has('align.left')).toBe(true);
    expect(ids.has('delete')).toBe(false);
    expect(ids.has('areaSelect')).toBe(false);
  });
});
