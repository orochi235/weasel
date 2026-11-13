import {
  type Action,
  type ActionDeps,
  ActionDisabledReason,
  effectivePose,
  type InvocationCtx,
} from '@weasel-js/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLensActions,
  createLoupeKeymap,
  LENS_ACTION_IDS,
  MAX_LENSES,
  QUICK_TAP_MS,
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

/** As a held binding runs one: started on the press; the returned function is the release. */
function press(id: string): () => void {
  const invoker = actionOf(id).invoker;
  if (!invoker || !('start' in invoker)) throw new Error(`${id} is not ongoing`);
  const ctx = { deps } as InvocationCtx;
  const { onEnd } = invoker.start(ctx, undefined) ?? {};
  return () => onEnd?.(ctx, 'commit');
}

/** The center a node is drawn at. */
function centerOf(id: string) {
  const p = effectivePose(api.scene, api.scene.get(id as never)!);
  return { x: p.x + p.width / 2, y: p.y + p.height / 2 };
}

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
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
      else if (a.id === LENS_ACTION_IDS.quick) expect(a.enabled).toBeUndefined();
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

  it('switches the current lens to Glass, its reticle set by the body', () => {
    trigger(LENS_ACTION_IDS.add);
    trigger(LENS_ACTION_IDS.glass);
    expect(settingsOf(api.scene, 'l0')!.aim).toBe('glass');
    expect(api.scene.get('l0:reticle' as never)!.dependsOn).toEqual(['l0:body']);
  });

  it('lets go of a Follow reticle on the switch to Glass', () => {
    trigger(LENS_ACTION_IDS.add);
    trigger(LENS_ACTION_IDS.follow);
    trigger(LENS_ACTION_IDS.followMove, { clientX: 500, clientY: 500 });
    expect(api.scene.overrides.read('l0:reticle' as never)).toBeDefined();
    trigger(LENS_ACTION_IDS.glass);
    expect(settingsOf(api.scene, 'l0')!.aim).toBe('glass');
    expect(api.scene.overrides.read('l0:reticle' as never)).toBeUndefined();
  });

  it('opens a Glass lens on the quick key, centered where its reticle lands, and keeps it when let go', () => {
    const release = press(LENS_ACTION_IDS.quick);
    const lensId = api.current()!;
    expect(settingsOf(api.scene, lensId)!.aim).toBe('glass');
    expect(centerOf(`${lensId}:body`)).toEqual({ x: 100, y: 100 });
    release();
    expect(lensesOf(api.scene)).toHaveLength(1);
  });

  it('carries the quick lens with the pointer while its key is held, and leaves it where it was let go', () => {
    trigger(LENS_ACTION_IDS.add);
    const release = press(LENS_ACTION_IDS.quick);
    const lensId = api.current()!;
    api.focus('l0');
    expect(trigger(LENS_ACTION_IDS.followMove, { clientX: 400, clientY: 250 })).toBe(true);
    // The body moves, and the reticle Glass derives from it with it: no source circle apart from the lens.
    expect(centerOf(`${lensId}:body`)).toEqual({ x: 400, y: 250 });
    expect(centerOf(`${lensId}:reticle`)).toEqual({ x: 400, y: 250 });
    expect(centerOf('l0:reticle')).toEqual({ x: 100, y: 100 });
    release();
    expect(api.scene.overrides.read(`${lensId}:body` as never)).toBeUndefined();
    expect(centerOf(`${lensId}:body`)).toEqual({ x: 400, y: 250 });
    // Let go, the pointer no longer moves it.
    api.focus(lensId);
    expect(trigger(LENS_ACTION_IDS.followMove, { clientX: 10, clientY: 10 })).toBe(false);
  });

  it('closes the quick lens on a tap of its key, and only that lens', () => {
    trigger(LENS_ACTION_IDS.add);
    press(LENS_ACTION_IDS.quick)();
    expect(lensesOf(api.scene)).toHaveLength(2);
    press(LENS_ACTION_IDS.quick)();
    expect(lensesOf(api.scene)).toHaveLength(1);
    expect(settingsOf(api.scene, 'l0')).not.toBeNull();
  });

  it('picks the open quick lens up on a long press instead of closing it', () => {
    press(LENS_ACTION_IDS.quick)();
    const lensId = api.current()!;
    const release = press(LENS_ACTION_IDS.quick);
    trigger(LENS_ACTION_IDS.followMove, { clientX: 300, clientY: 300 });
    vi.advanceTimersByTime(QUICK_TAP_MS);
    release();
    expect(lensesOf(api.scene)).toHaveLength(1);
    expect(centerOf(`${lensId}:body`)).toEqual({ x: 300, y: 300 });
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
    const glass = keymap!.bindings!.find((b) => b.actionId === LENS_ACTION_IDS.glass)!;
    expect(glass.spec).toEqual({ kind: 'key', key: 'b' });
    // The follow hover is no key: it binds outside the keymap.
    expect(keymap!.bindings!.some((b) => b.actionId === LENS_ACTION_IDS.followMove)).toBe(false);
    // The quick key binds outside it too, with no leader before it.
    const quick = leader!.actions!.find((a) => a.id === LENS_ACTION_IDS.quick)!;
    expect(quick.defaultBinding).toEqual([
      expect.objectContaining({ spec: { kind: 'keyHeld', key: 'F2' } }),
    ]);
    expect(keymap!.bindings!.some((b) => b.actionId === LENS_ACTION_IDS.quick)).toBe(false);
  });
});
