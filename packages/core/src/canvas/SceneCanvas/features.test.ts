import { describe, it, expect } from 'vitest';
import type { Action } from '@weasel-js/routing';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
import {
  SCENE_CANVAS_FEATURES,
  resolveFeatures,
  presetActions,
  presetAmbient,
  presetBuiltinTools,
  presetChromeRules,
  type BaseFeature,
  type FeatureEntry,
  type FeaturePreset,
} from './features';
import {
  COMPOSITE_FEATURES,
  CORE_NAMED_PRESETS,
  FEATURE_ACTION_IDS,
  FEATURE_PRESETS,
  BASELINE_ACTION_IDS, TOOL_DRIVEN_ACTION_IDS,
} from './namedPresets';
import { PRESET_OWNED_CHROME } from './presets/chrome';
import { BUILTIN_TOOL_IDS } from './props';
import { defaultVisibilityRules, never } from 'features/chrome-caps';
import {
  SELECTION_MOVE_ID,
  SELECTION_RESIZE_ID,
  SELECTION_ROTATE_ID,
} from 'tools/builtin/select/selectionContributions';

const resolve = (features?: readonly FeatureEntry[], opts?: { viewport?: boolean }) =>
  resolveFeatures(features, CORE_NAMED_PRESETS, opts);
const ids = (features: readonly FeatureEntry[]) => resolve(features).presets.map((p) => p.id);
const actionIds = (features: readonly FeatureEntry[]) => new Set(presetActions(resolve(features)).map((a) => a.id));
const action = (id: string): Action => ({ id, label: id, invoker: { timing: 'immediate', run: () => {} } }) as Action;

describe('FEATURE_ACTION_IDS', () => {
  it('places every kit-standard action under exactly one preset, the baseline, or its tools', () => {
    const owners = new Map<string, string[]>();
    for (const [feature, ids] of Object.entries(FEATURE_ACTION_IDS)) {
      for (const id of ids) owners.set(id, [...(owners.get(id) ?? []), feature]);
    }
    for (const id of TOOL_DRIVEN_ACTION_IDS) owners.set(id, [...(owners.get(id) ?? []), 'tool']);
    for (const id of BASELINE_ACTION_IDS) owners.set(id, [...(owners.get(id) ?? []), 'baseline']);

    for (const id of KIT_STANDARD_ACTION_IDS) {
      expect(owners.get(id), id).toHaveLength(1);
    }
    // No preset names an action the kit does not ship.
    expect([...owners.keys()].filter((id) => !KIT_STANDARD_ACTION_IDS.includes(id))).toEqual([]);
  });
});

describe('resolveFeatures', () => {
  it('is empty for a bare canvas', () => {
    expect(resolve(undefined).presets).toEqual([]);
    expect(resolve([]).presets).toEqual([]);
  });

  it('expands draw to every preset no other one abbreviates', () => {
    const all = SCENE_CANVAS_FEATURES.filter((f) => !(f in COMPOSITE_FEATURES));
    expect(ids(['draw']).sort()).toEqual([...all].sort());
  });

  it('adds view when a viewport config is passed', () => {
    expect(resolve(['outline'], { viewport: true }).presets.map((p) => p.id).sort()).toEqual(['outline', 'view']);
  });

  it('expands pick to select + outline and transform to resize + rotate', () => {
    expect(ids(['pick']).sort()).toEqual(['outline', 'select']);
    expect(ids(['transform']).sort()).toEqual(['resize', 'rotate']);
  });

  it('registers resize without rotate', () => {
    expect(actionIds(['resize']).has('resize')).toBe(true);
    expect(actionIds(['resize']).has('rotate')).toBe(false);
  });

  it('gives edit the paste-event action, apart from ingest', () => {
    expect(actionIds(['edit']).has('clipboard.pasteEvent')).toBe(true);
    expect(actionIds(['edit']).has('ingest')).toBe(false);
  });

  it('composes presets independently', () => {
    const on = actionIds(['move', 'arrange']);
    expect(on.has('move')).toBe(true);
    expect(on.has('align.left')).toBe(true);
    expect(on.has('delete')).toBe(false);
    expect(on.has('areaSelect')).toBe(false);
  });

  it('takes a preset object beside the names, once however often it is named', () => {
    const mine: FeaturePreset = { id: 'mine', actions: [action('mine.go')] };
    expect(ids(['select', mine, mine])).toEqual(['select', 'mine']);
    expect(actionIds([mine]).has('mine.go')).toBe(true);
  });

  it('throws on two different presets with one id', () => {
    expect(() => resolve([{ id: 'x' }, { id: 'x' }])).toThrow(/two different presets have the id "x"/);
  });

  it('turns on what a preset includes, ahead of it', () => {
    const inner: FeaturePreset = { id: 'inner' };
    expect(ids([{ id: 'outer', includes: [inner] }])).toEqual(['inner', 'outer']);
  });

  it('places a preset ahead of the ones it refines, and ignores a refined preset that is off', () => {
    const anchor: FeaturePreset = { id: 'anchor', refines: ['edit', 'absent'] };
    expect(ids(['edit', 'arrange', anchor])).toEqual(['anchor', 'edit', 'arrange']);
    expect(ids(['draw']).indexOf('paths')).toBeLessThan(ids(['draw']).indexOf('edit'));
  });

  it('resolves no names where none are given, and says which', () => {
    expect(() => resolveFeatures(['select'], null)).toThrow(/pass the preset for "select"/);
    expect(resolveFeatures([], null, { viewport: true }).presets).toEqual([]);
  });

  it("gathers the presets' path-edit extensions in preset order, and lays their chrome rules under the owned ones", () => {
    const a = { id: 'a.marks' };
    const b = { id: 'b.marks' };
    const on = resolve([{ id: 'a', pathEdit: [a] }, { id: 'b', pathEdit: [b], chromeRules: { 'b.chrome': never } }]);
    expect(on.pathEdit).toEqual([a, b]);
    expect(presetChromeRules(on, ['selection.outline'])).toEqual({ 'b.chrome': never, 'selection.outline': never });
  });

  it('answers whether a preset is on by id', () => {
    const on = resolve(['pick']);
    expect(on.has('select')).toBe(true);
    expect(on.has('view')).toBe(false);
  });
});

describe('FEATURE_PRESETS', () => {
  const rows = Object.entries(FEATURE_PRESETS) as [BaseFeature, FeaturePreset][];
  const all = resolve(['draw']);

  it('has one row for every preset that abbreviates nothing, each under its own id', () => {
    const bases = SCENE_CANVAS_FEATURES.filter((f) => !(f in COMPOSITE_FEATURES));
    expect(rows.map(([id]) => id).sort()).toEqual([...bases].sort());
    for (const [id, row] of rows) expect(row.id).toBe(id);
    for (const named of Object.values(COMPOSITE_FEATURES)) {
      for (const f of named) expect(f in FEATURE_PRESETS, f).toBe(true);
    }
  });

  it('is where the action table comes from', () => {
    for (const [id, row] of rows) expect(FEATURE_ACTION_IDS[id]).toEqual((row.actions ?? []).map((a) => a.id));
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
      for (const actionId of bound) expect((row.actions ?? []).map((a) => a.id), id).toContain(actionId);
    }
  });

  it("mounts each preset's tools and no other", () => {
    for (const [id, row] of rows) {
      expect([...presetBuiltinTools(resolve([id]))], id).toEqual([...(row.tools ?? [])]);
    }
    expect([...presetBuiltinTools(all)].sort()).toEqual(['hand', 'select']);
  });

  it("installs each preset's ambient entry alone, and handles ahead of the body when together", () => {
    for (const [id, row] of rows) {
      const entries = presetAmbient(resolve([id]), {});
      expect(entries.map((e) => e.id), id).toEqual(row.ambient ? [row.ambient({}).id] : []);
    }
    expect(presetAmbient(all, {}).map((e) => e.id)).toEqual([
      SELECTION_RESIZE_ID, SELECTION_ROTATE_ID, SELECTION_MOVE_ID,
    ]);
  });

  it('hands the move and rotate options to the entries they configure', () => {
    const [, rotate, move] = presetAmbient(all, { move: { dragThresholdPx: 9 }, rotate: { rotateLabel: 'Spin' } });
    expect(move.bindings!.find((b) => b.actionId === 'move')!.opts!.dragThresholdPx).toBe(9);
    expect(rotate.bindings![0].opts!.params).toMatchObject({ label: 'Spin' });
  });

  it("folds a preset's move behaviors into the move, after the select tool's", () => {
    const own = { onMove: () => undefined };
    const added = { onMove: () => undefined };
    const snapping: FeaturePreset = { id: 'snapping', moveBehaviors: [added] };
    const entries = presetAmbient(resolve(['move', snapping]), { move: { behaviors: [own] } });
    const move = entries.find((e) => e.id === SELECTION_MOVE_ID)!;
    expect(move.bindings!.find((b) => b.actionId === 'move')!.opts!.behaviors).toEqual([own, added]);
    const bare = presetAmbient(resolve(['move']), {}).find((e) => e.id === SELECTION_MOVE_ID)!;
    expect(bare.bindings!.find((b) => b.actionId === 'move')!.opts?.behaviors).toBeUndefined();
  });

  it('owns, in the chrome table, exactly the chrome its rows turn on', () => {
    expect([...PRESET_OWNED_CHROME].sort()).toEqual(rows.flatMap(([, row]) => row.chrome ?? []).sort());
  });

  it('hides the chrome of every preset that is off, and of none that is on', () => {
    const owned = PRESET_OWNED_CHROME;
    expect(Object.keys(presetChromeRules(resolve([]), owned)).sort()).toEqual([...owned].sort());
    expect(presetChromeRules(all, owned)).toEqual({});
    for (const [id, row] of rows) {
      const hidden = presetChromeRules(resolve([id]), owned);
      expect(Object.keys(hidden).sort(), id).toEqual(owned.filter((c) => !(row.chrome ?? []).includes(c)).sort());
      for (const rule of Object.values(hidden)) expect(rule).toBe(never);
    }
  });
});
