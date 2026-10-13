import { describe, it, expect } from 'vitest';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
import {
  FEATURE_ACTION_IDS,
  TOOL_DRIVEN_ACTION_IDS,
  SCENE_CANVAS_FEATURES,
  COMPOSITE_FEATURES,
  resolveFeatures,
  featureActionIds,
  featureAmbient,
  featureChromeRules,
  featureToolIds,
  FEATURE_PRESETS,
  type BaseFeature,
  type FeaturePreset,
} from './features';
import { BUILTIN_TOOL_IDS } from './props';
import { defaultVisibilityRules, never } from 'features/chrome-caps';
import {
  SELECTION_MOVE_ID,
  SELECTION_RESIZE_ID,
  SELECTION_ROTATE_ID,
} from 'tools/builtin/select/selectionContributions';

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

describe('FEATURE_PRESETS', () => {
  const rows = Object.entries(FEATURE_PRESETS) as [BaseFeature, FeaturePreset][];
  const all = new Set(rows.map(([id]) => id));

  it('has one row for every preset that abbreviates nothing', () => {
    const bases = SCENE_CANVAS_FEATURES.filter((f) => !(f in COMPOSITE_FEATURES));
    expect([...all].sort()).toEqual([...bases].sort());
    for (const named of Object.values(COMPOSITE_FEATURES)) {
      for (const f of named) expect(all.has(f), f).toBe(true);
    }
  });

  it('is where the action table comes from', () => {
    for (const [id, row] of rows) expect(FEATURE_ACTION_IDS[id]).toBe(row.actions);
  });

  it('names only built-in tools, and only chrome the kit has a rule for', () => {
    for (const [id, row] of rows) {
      for (const tool of row.tools ?? []) expect(BUILTIN_TOOL_IDS, id).toContain(tool);
      for (const chrome of row.chrome ?? []) expect(Object.keys(defaultVisibilityRules), id).toContain(chrome);
    }
  });

  it('binds, from a row, only actions that row registers', () => {
    for (const [id, row] of rows) {
      const bound = (row.ambient?.({}).bindings ?? []).map((b) => b.actionId);
      for (const actionId of bound) expect(row.actions, id).toContain(actionId);
    }
  });

  it("mounts each preset's tools and no other", () => {
    for (const [id, row] of rows) {
      expect([...featureToolIds(new Set([id]))], id).toEqual([...(row.tools ?? [])]);
    }
    expect([...featureToolIds(all)].sort()).toEqual(['hand', 'select']);
  });

  it("installs each preset's ambient entry alone, and handles ahead of the body when together", () => {
    for (const [id, row] of rows) {
      const entries = featureAmbient(new Set([id]), {});
      expect(entries.map((e) => e.id), id).toEqual(row.ambient ? [row.ambient({}).id] : []);
    }
    expect(featureAmbient(all, {}).map((e) => e.id)).toEqual([
      SELECTION_RESIZE_ID, SELECTION_ROTATE_ID, SELECTION_MOVE_ID,
    ]);
  });

  it('hands the move and rotate options to the entries they configure', () => {
    const [, rotate, move] = featureAmbient(all, { move: { dragThresholdPx: 9 }, rotate: { rotateLabel: 'Spin' } });
    expect(move.bindings!.find((b) => b.actionId === 'move')!.opts!.params).toMatchObject({ dragThresholdPx: 9 });
    expect(rotate.bindings![0].opts!.params).toMatchObject({ label: 'Spin' });
  });

  it('hides the chrome of every preset that is off, and of none that is on', () => {
    const owned = rows.flatMap(([, row]) => row.chrome ?? []);
    expect(Object.keys(featureChromeRules(new Set())).sort()).toEqual([...owned].sort());
    expect(featureChromeRules(all)).toEqual({});
    for (const [id, row] of rows) {
      const hidden = featureChromeRules(new Set([id]));
      expect(Object.keys(hidden).sort(), id).toEqual(owned.filter((c) => !(row.chrome ?? []).includes(c)).sort());
      for (const rule of Object.values(hidden)) expect(rule).toBe(never);
    }
  });
});
