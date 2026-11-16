import { describe, it, expect } from 'vitest';
import type { Action } from '@weasel-js/routing';
import {
  resolveFeatures,
  presetActions,
  presetAmbient,
  presetBuiltinTools,
  presetChromeRules,
  presetToolIds,
  type FeaturePreset,
} from './features';
import { BASELINE_ACTION_IDS } from './presets/baseline';
import { TOOL_DRIVEN_ACTION_IDS } from './presets/toolDriven';
import { PRESET_OWNED_CHROME } from './presets/chrome';
import { defaultVisibilityRules, never } from 'domains/chrome-caps';
import {
  SELECTION_MOVE_ID,
  SELECTION_RESIZE_ID,
  SELECTION_ROTATE_ID,
} from 'tools/builtin/select/selectionContributions';
import { MIDDLE_DRAG_PAN_ID } from 'tools/builtin/hand/dragPanContribution';
import { BUILTIN_TOOL_IDS, KIT_STANDARD_ACTION_IDS, FEATURE_ACTION_IDS, FEATURE_NAMES, FEATURE_PRESETS, namedFeatures, type FeatureName } from '@weasel-js/editing';

// Names keep these tables readable; `namedFeatures` maps each to its object.
type Entry = FeatureName | FeaturePreset;
const resolve = (features?: readonly Entry[]) =>
  resolveFeatures(features?.map((f) => (typeof f === 'string' ? namedFeatures(f)[0]! : f)));
const ids = (features: readonly Entry[]) => resolve(features).presets.map((p) => p.id);
const actionIds = (features: readonly Entry[]) => new Set(presetActions(resolve(features)).map((a) => a.id));
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

  it('turns on, under draw, every core preset but the tools that make things and the shorthands beside it', () => {
    const left = ['tools:shape', 'pick', 'transform'];
    expect(ids(['draw']).sort()).toEqual(FEATURE_NAMES.filter((f) => !left.includes(f)).sort());
  });

  it('registers, under draw, every kit-standard action a preset owns', () => {
    const owned = Object.values(FEATURE_ACTION_IDS).flat();
    expect([...actionIds(['draw'])].sort()).toEqual([...owned].sort());
  });

  it('turns on only what it is handed: nothing implies view', () => {
    expect(ids(['outline'])).toEqual(['outline']);
  });

  it('turns on select and outline under pick, and resize and rotate under transform', () => {
    expect(ids(['pick'])).toEqual(['toolkit:select', 'tools:select', 'select', 'outline', 'pick']);
    expect(ids(['transform'])).toEqual(['resize', 'rotate', 'transform']);
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
    expect(ids(['select', mine, mine])).toEqual(['toolkit:select', 'tools:select', 'select', 'mine']);
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
    expect(ids([{ id: 'edit' }, { id: 'arrange' }, anchor])).toEqual(['anchor', 'edit', 'arrange']);
  });

  it('places a preset refining a bundle ahead of everything that bundle includes', () => {
    const widgets: FeaturePreset = { id: 'widgets', refines: ['edit'] };
    const order = ids(['edit', widgets]);
    for (const inner of ['nudge', 'delete', 'escape', 'edit']) {
      expect(order.indexOf('widgets'), inner).toBeLessThan(order.indexOf(inner));
    }
  });

  it('tries each path-edit key ahead of the node-level action bound to the same key', () => {
    const order = presetActions(resolve(['draw'])).map((a) => a.id);
    const before = (a: string, b: string) => expect(order.indexOf(a), `${a} before ${b}`).toBeLessThan(order.indexOf(b));
    before('nudgeAnchors.up', 'nudge.up');
    before('deleteAnchors', 'delete');
    for (const twin of ['escape', 'cancelGesture']) before('exitPathEdit', twin);
  });

  it('takes no names, and says what to pass instead', () => {
    expect(() => resolveFeatures(['select' as never])).toThrow(/pass the preset for "select" or namedFeatures\("select"\)/);
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
  const rows = Object.entries(FEATURE_PRESETS) as [FeatureName, FeaturePreset][];
  // A preset that includes others turns them on too, so what it alone brings is read from those that include none.
  const leaves = rows.filter(([, row]) => !row.includes?.length);
  const all = resolve(['draw']);

  it('has one row for every name, each under its own id, and includes only named presets', () => {
    expect(rows.map(([id]) => id)).toEqual([...FEATURE_NAMES]);
    for (const [id, row] of rows) expect(row.id).toBe(id);
    for (const [, row] of rows) for (const inner of row.includes ?? []) expect(FEATURE_PRESETS[inner.id as FeatureName]).toBe(inner);
  });

  it('is where the action table comes from', () => {
    for (const [id, row] of rows) expect(FEATURE_ACTION_IDS[id]).toEqual((row.actions ?? []).map((a) => a.id));
  });

  it('names only built-in tools, and only chrome the kit has a rule for', () => {
    for (const [id, row] of rows) {
      for (const tool of presetToolIds(row)) expect(BUILTIN_TOOL_IDS, id).toContain(tool);
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
    for (const [id, row] of leaves) {
      expect([...presetBuiltinTools(resolve([id]))], id).toEqual(presetToolIds(row));
    }
    expect([...presetBuiltinTools(all)].sort()).toEqual(['hand', 'lasso', 'select']);
  });

  it("installs each preset's ambient entry alone, and handles ahead of the body when together", () => {
    for (const [id, row] of leaves) {
      const entries = presetAmbient(resolve([id]), {});
      expect(entries.map((e) => e.id), id).toEqual(row.ambient ? [row.ambient({}).id] : []);
    }
    const ids = presetAmbient(all, {}).map((e) => e.id);
    expect(ids).toContain(MIDDLE_DRAG_PAN_ID);
    expect(ids.filter((id) => id !== MIDDLE_DRAG_PAN_ID)).toEqual([
      SELECTION_RESIZE_ID, SELECTION_ROTATE_ID, SELECTION_MOVE_ID,
    ]);
  });

  it('hands the move and rotate options to the entries they configure', () => {
    const entries = presetAmbient(all, { move: { dragThresholdPx: 9 }, rotate: { rotateLabel: 'Spin' } });
    const rotate = entries.find((e) => e.id === SELECTION_ROTATE_ID)!;
    const move = entries.find((e) => e.id === SELECTION_MOVE_ID)!;
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
    for (const [id] of rows) {
      const on = resolve([id]);
      const shown = on.presets.flatMap((p) => p.chrome ?? []);
      const hidden = presetChromeRules(on, owned);
      expect(Object.keys(hidden).sort(), id).toEqual(owned.filter((c) => !shown.includes(c)).sort());
      for (const rule of Object.values(hidden)) expect(rule).toBe(never);
    }
  });
});

describe('EnabledPresets.layers', () => {
  const entry = (id: string) => ({ layer: { id, label: id, draw: () => [] } });

  it('collects each preset\'s layers by slot, a later preset winning a slot both name', () => {
    const a: FeaturePreset = { id: 'a', layers: { grid: entry('a-grid'), ruler: entry('a-ruler') } };
    const b: FeaturePreset = { id: 'b', layers: { grid: entry('b-grid') } };
    const { layers } = resolve([a, b]);
    expect(layers.grid!.layer.id).toBe('b-grid');
    expect(layers.ruler!.layer.id).toBe('a-ruler');
    expect(resolve(['draw']).layers).toEqual({});
  });
});

describe('namedFeatures', () => {
  it('maps each name to its core preset, in order, and nothing else', () => {
    expect(namedFeatures('pick', 'move')).toEqual([FEATURE_PRESETS.pick, FEATURE_PRESETS.move]);
    expect(namedFeatures()).toEqual([]);
  });

  it('throws on a name no kit preset has', () => {
    expect(() => namedFeatures('nope' as FeatureName)).toThrow(/no kit preset is named "nope"/);
  });
});
