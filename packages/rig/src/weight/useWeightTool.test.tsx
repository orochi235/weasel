import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import type { RenderLayer } from '@weasel-js/core';
import { createScene } from '@weasel-js/core';
import type { RectPose } from '@weasel-js/core';
import type { Skin } from '@weasel-js/animator';
import { IDENTITY_JOINT, type Skeleton } from '@weasel-js/animator';
import { createRigEditState } from '../bone/rigEditState';
import { useWeightTool } from './useWeightTool';
import { POINT_RADIUS_PX } from './weightOverlay';
import { JOINT_RADIUS_PX } from '../bone/boneOverlay';
import { boundsOfPath } from '@weasel-js/geom';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import type { ReactNode } from 'react';
import type { DrawCommand } from '@weasel-js/renderer';

type Data = { skeleton?: Skeleton; skin?: Skin; path?: Path };

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
/** In the rig node's box at (100, 100): a at (100, 150), b at (200, 150), c at (300, 150). */
const ARM: Skeleton = {
  joints: [
    { name: 'a', parent: null, bind: { ...IDENTITY_JOINT, x: 0, y: 50 } },
    { name: 'b', parent: 'a', bind: { ...IDENTITY_JOINT, x: 100 } },
    { name: 'c', parent: 'b', bind: { ...IDENTITY_JOINT, x: 100 } },
  ],
};

function setup(settings?: KitSettingsOverrides) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const rig = scene.add({ kind: 'container', layer: 'main', pose: { x: 100, y: 100, width: 200, height: 100 }, data: { skeleton: ARM } });
  const sleeve = scene.add({
    kind: 'leaf', layer: 'main', parent: rig, pose: { x: 110, y: 120, width: 180, height: 20 },
    data: { path: polygonFromPoints([{ x: 110, y: 120 }, { x: 190, y: 120 }, { x: 290, y: 120 }, { x: 200, y: 140 }]) },
  });
  const state = createRigEditState();
  const { result } = renderHook(() => useWeightTool({ scene: scene as never, rig: () => rig, state }), {
    ...(settings ? { wrapper: ({ children }: { children: ReactNode }) => <KitSettingsProvider value={settings}>{children}</KitSettingsProvider> } : {}),
  });
  const deps = { view: { get: () => VIEW, set: () => {} } } as unknown as ActionDeps;
  const actionOf = (id: string): Action => (result.current.actions ?? []).find((x) => x.id === id)!;
  const ctx = (x: number, y: number, alt: boolean): InvocationCtx => ({
    world: { x, y }, screen: { x, y }, modifiers: { alt, ctrl: false, meta: false, shift: false }, deps,
    drag: { start: { x, y }, current: { x, y }, delta: { x: 0, y: 0 } },
  });
  /** Press at the first point and move through the rest. */
  const stroke = (points: [number, number][], o: { alt?: boolean; reason?: 'commit' | 'cancel'; peek?: () => void } = {}) => {
    const action = actionOf('weight.paint');
    if (action.enabled && action.enabled(deps) !== true) return false;
    if (action.invoker?.timing !== 'ongoing') throw new Error('weight.paint is not ongoing');
    const handle = action.invoker.start(ctx(points[0][0], points[0][1], !!o.alt), undefined);
    for (const [x, y] of points.slice(1)) handle.onMove?.(ctx(x, y, !!o.alt));
    o.peek?.();
    handle.onEnd?.({ ...ctx(0, 0, false), deps: {} as ActionDeps }, o.reason ?? 'commit');
    return true;
  };
  const click = (x: number, y: number, alt = false) => {
    const invoker = actionOf('weight.click').invoker;
    if (invoker?.timing !== 'immediate') throw new Error('weight.click is not immediate');
    invoker.run(deps, { pressX: x, pressY: y, mods: { alt } });
  };
  const skin = () => {
    const s = scene.get(sleeve)!.data.skin;
    return s && Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map((n) => Math.round(n * 100) / 100)]));
  };
  const layers = result.current.overlay as RenderLayer<unknown>[];
  const painted = (i: number) => layers[i].draw(undefined, VIEW, { width: 400, height: 400 });
  return { scene, state, stroke, click, skin, painted };
}

describe('useWeightTool', () => {
  it('paints the active joint onto the points under the brush, as one undo entry', () => {
    const t = setup();
    t.state.setActive('a');
    t.stroke([[110, 120], [190, 132]]);
    // The second dab is 12 from the second point, half the brush's 24.
    expect(t.skin()).toEqual({ a: [1, 1, 0, 1] });
    t.scene.undo();
    expect(t.skin()).toBeUndefined();
  });

  it('makes a point\'s other joints give way', () => {
    const t = setup();
    t.state.setActive('a');
    t.stroke([[110, 120]]);
    t.state.setActive('b');
    t.stroke([[122, 120]]);
    expect(t.skin()).toEqual({ a: [0.5, 0, 0, 0], b: [0.5, 0, 0, 0] });
  });

  it('lowers the active joint with Alt held', () => {
    const t = setup();
    t.state.setActive('a');
    t.stroke([[110, 120]]);
    t.state.setActive('b');
    t.stroke([[110, 120]]);
    t.stroke([[122, 120]], { alt: true });
    expect(t.skin()).toEqual({ b: [1, 0, 0, 0] });
    t.state.setActive('a');
    t.stroke([[122, 120]]);
    t.state.setActive('b');
    t.stroke([[110, 120]], { alt: true });
    expect(t.skin()).toEqual({ a: [1, 0, 0, 0] });
  });

  it('shows a stroke as it is painted and writes nothing until it ends, or at all on a cancel', () => {
    const t = setup();
    t.state.setActive('a');
    const fills = () => t.painted(0).map((c) => (c as { fill: { paint: { color: string } } }).fill.paint.color);
    const cold = fills()[0];
    let during: string[] = [];
    t.stroke([[110, 120]], { reason: 'cancel', peek: () => { during = fills(); } });
    expect(during[0]).not.toBe(cold);
    expect(during[2]).toBe(cold);
    expect(t.skin()).toBeUndefined();
    expect(fills()[0]).toBe(cold);
  });

  it('sizes its point and joint dots from the targets kit settings, else the constants', () => {
    const widths = (cmds: DrawCommand[]) => cmds.filter((c) => c.kind === 'path' && c.fill).map((c) => (c.kind === 'path' ? boundsOfPath(c.path).width : 0));
    const plain = setup();
    expect(new Set(widths(plain.painted(0)))).toEqual(new Set([2 * POINT_RADIUS_PX]));
    expect(new Set(widths(plain.painted(1)))).toEqual(new Set([2 * JOINT_RADIUS_PX]));
    const set = setup({ targets: { weightPointRadiusPx: 6, boneJointRadiusPx: 9 } });
    expect(new Set(widths(set.painted(0)))).toEqual(new Set([12]));
    expect(new Set(widths(set.painted(1)))).toEqual(new Set([18]));
  });

  it('draws a dot on every point and the skeleton over them', () => {
    const t = setup();
    expect(t.painted(0)).toHaveLength(4);
    // Two bones and three joints.
    expect(t.painted(1)).toHaveLength(5);
  });

  it('picks a clicked joint, and dabs on a click away from one', () => {
    const t = setup();
    t.click(203, 148);
    expect(t.state.active()).toBe('b');
    t.click(290, 120);
    expect(t.skin()).toEqual({ b: [0, 0, 1, 0] });
    expect(t.state.active()).toBe('b');
  });

  it('declines to paint with no joint active', () => {
    const t = setup();
    expect(t.stroke([[110, 120]])).toBe(false);
    t.click(110, 120);
    expect(t.skin()).toBeUndefined();
  });
});
