import { type Action, type ActionDeps, ActionDisabledReason } from '@weasel-js/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLensActions,
  createLoupeKeymap,
  LENS_ACTION_IDS,
  MAX_LENSES,
} from './lensActionDefs';
import { lensApiFixture, PIXELS_MISSING } from './lensApi.fixture';
import { lensesOf, settingsOf } from './lensScene';

let api: ReturnType<typeof lensApiFixture>;
let actions: readonly Action[];
const deps = {} as ActionDeps;

const actionOf = (id: string): Action => {
  const a = actions.find((x) => x.id === id);
  if (!a) throw new Error(`no action ${id}`);
  return a;
};

/** As `ActionsRegistry.trigger` runs one: asked first, run only when enabled. */
function trigger(id: string, params?: Record<string, unknown>): boolean {
  const a = actionOf(id);
  if (a.enabled && a.enabled(deps) !== true) return false;
  const invoker = a.invoker;
  if (!invoker || !('run' in invoker)) throw new Error(`${id} is not immediate`);
  invoker.run(deps, params);
  return true;
}

beforeEach(() => {
  api = lensApiFixture();
  actions = createLensActions(api, { opposite: () => 'dark' });
});

describe('lens actions', () => {
  it('declines the ninth lens with a reason', () => {
    for (let i = 0; i < 9; i++) trigger(LENS_ACTION_IDS.add);
    expect(lensesOf(api.scene)).toHaveLength(MAX_LENSES);
    expect(actionOf(LENS_ACTION_IDS.add).enabled!(deps)).toMatch(/8 lenses/);
  });

  it('cycles DPR 1×, 2×, 1×|2×', () => {
    trigger(LENS_ACTION_IDS.add);
    const dprs = () => settingsOf(api.scene, api.current()!)!.dprs;
    expect(dprs()).toEqual([1]);
    trigger(LENS_ACTION_IDS.dpr);
    expect(dprs()).toEqual([2]);
    trigger(LENS_ACTION_IDS.dpr);
    expect(dprs()).toEqual([1, 2]);
    trigger(LENS_ACTION_IDS.dpr);
    expect(dprs()).toEqual([1]);
  });

  it('declines every lens key but add while no lens is up', () => {
    for (const a of actions) {
      if (a.id === LENS_ACTION_IDS.add) expect(a.enabled!(deps)).toBe(true);
      else expect(a.enabled!(deps), a.id).toBe(ActionDisabledReason.NotApplicable);
    }
  });

  it('steps the factor by ×2 within 1 and 64', () => {
    trigger(LENS_ACTION_IDS.add);
    const factor = () => settingsOf(api.scene, api.current()!)!.factor;
    for (let i = 0; i < 8; i++) trigger(LENS_ACTION_IDS.zoomIn);
    expect(factor()).toBe(64);
    for (let i = 0; i < 8; i++) trigger(LENS_ACTION_IDS.zoomOut);
    expect(factor()).toBe(1);
  });

  it('offers Pixels only while the source is available, giving its reason', () => {
    trigger(LENS_ACTION_IDS.add);
    expect(actionOf(LENS_ACTION_IDS.pixels).enabled!(deps)).toBe(PIXELS_MISSING);
    expect(actionOf(LENS_ACTION_IDS.live).enabled!(deps)).toBe(true);
  });

  it('closes the current lens whole, and undo brings it back', () => {
    trigger(LENS_ACTION_IDS.add);
    trigger(LENS_ACTION_IDS.add);
    trigger(LENS_ACTION_IDS.close);
    expect(lensesOf(api.scene).map((l) => l.lensId)).toEqual(['l0']);
    expect(api.scene.get('l1:reticle' as never)).toBeUndefined();
    expect(api.scene.get('l1:leader' as never)).toBeUndefined();
    api.scene.history.undo();
    expect(lensesOf(api.scene).map((l) => l.lensId)).toEqual(['l0', 'l1']);
  });

  it('toggles a readout, sets the comparison to the opposite and clears it', () => {
    trigger(LENS_ACTION_IDS.add);
    const s = () => settingsOf(api.scene, api.current()!)!;
    trigger(LENS_ACTION_IDS.token);
    expect(s().readouts).toEqual(['token']);
    trigger(LENS_ACTION_IDS.token);
    expect(s().readouts).toEqual([]);
    trigger(LENS_ACTION_IDS.opposite);
    expect(s().compare).toBe('dark');
    trigger(LENS_ACTION_IDS.clearCompare);
    expect(s().compare).toBeNull();
  });

  it('opens the compare menu on the current lens', () => {
    trigger(LENS_ACTION_IDS.add);
    trigger(LENS_ACTION_IDS.compareMenu);
    expect(api.openCompareMenu).toHaveBeenCalledWith('l0');
  });
});

describe('createLoupeKeymap', () => {
  it('binds each key under the Alt+L leader with the action id as its binding id', () => {
    const [keymap, leader] = createLoupeKeymap(actions);
    expect(keymap!.id).toBe('loupe');
    expect(keymap!.presentation?.label).toBe('Loupe');
    const add = keymap!.bindings!.find((b) => b.actionId === LENS_ACTION_IDS.add)!;
    expect(add.spec).toEqual({ kind: 'key', key: 'l' });
    expect(add.opts?.id).toBe(LENS_ACTION_IDS.add);
    const close = keymap!.bindings!.find((b) => b.actionId === LENS_ACTION_IDS.close)!;
    expect(close.spec).toEqual({ kind: 'key', key: 'L', mods: { shift: true } });
    const open = leader!.actions!.find((a) => a.id === 'keymap.loupe')!;
    expect(open.defaultBinding).toEqual([
      expect.objectContaining({
        spec: { kind: 'key', key: 'L', mods: { alt: true }, code: 'KeyL' },
      }),
    ]);
    // The follow hover is no key: it binds outside the keymap.
    expect(keymap!.bindings!.some((b) => b.actionId === LENS_ACTION_IDS.followMove)).toBe(false);
  });
});
