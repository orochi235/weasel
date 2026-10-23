import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { polygonFromPoints, type Path, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { IDENTITY_JOINT, type Skeleton, type Skin } from '@weasel-js/animator';
import { createScene } from '@weasel-js/core';
import type { RectPose } from '@weasel-js/core';
import type { Rig } from '@weasel-js/core';
import { useRigNode } from '@weasel-js/core';
import { createRigEditState } from '../bone/rigEditState';
import type { Tool } from '@weasel-js/core';
import { useWeightTool } from './useWeightTool';

type Data = { skeleton?: Skeleton; skin?: Skin; path?: Path };

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
/** In the rig node's box at (100, 100): a at (100, 150), b at (200, 150). */
const ARM: Skeleton = {
  joints: [
    { name: 'a', parent: null, bind: { ...IDENTITY_JOINT, x: 0, y: 50 } },
    { name: 'b', parent: 'a', bind: { ...IDENTITY_JOINT, x: 100 } },
  ],
};
const TURN = 0.5;

function setup() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const node = scene.add({ kind: 'group', layer: 'main', pose: { x: 100, y: 100, width: 200, height: 100 }, data: { skeleton: ARM } });
  const sleeve = scene.add({
    kind: 'mark', layer: 'main', parent: node, pose: { x: 110, y: 120, width: 180, height: 20 },
    data: { path: polygonFromPoints([{ x: 110, y: 120 }, { x: 190, y: 120 }, { x: 290, y: 120 }, { x: 200, y: 140 }]) },
  });
  const state = createRigEditState();
  let rig!: Rig;
  let tool!: Tool;
  function Probe() {
    tool = useWeightTool({ scene: scene as never, rig: () => node, state });
    rig = useRigNode({ scene, node, painting: state });
    return null;
  }
  render(<Probe />);
  act(() => { rig.pose({ b: { rotation: TURN } }); });

  const deps = { view: { get: () => VIEW, set: () => {} } } as unknown as ActionDeps;
  const ctx = (x: number, y: number): InvocationCtx => ({
    world: { x, y }, screen: { x, y }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps,
    drag: { start: { x, y }, current: { x, y }, delta: { x: 0, y: 0 } },
  });
  const press = (x: number, y: number): OngoingHandle => {
    const invoker = (tool.actions ?? []).find((a) => a.id === 'weight.paint')!.invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('weight.paint is not ongoing');
    let handle!: OngoingHandle;
    act(() => { handle = invoker.start(ctx(x, y), undefined); });
    return handle;
  };
  const end = (handle: OngoingHandle, reason: 'commit' | 'cancel') =>
    act(() => { handle.onEnd?.({ ...ctx(0, 0), deps: {} as ActionDeps }, reason); });
  /** Where the sleeve's third point, at rest (290, 120), is on screen. */
  const third = (): [number, number] | undefined => {
    const path = scene.overrides.read(sleeve)?.path as PolygonPath | undefined;
    return path && [path.coords[4], path.coords[5]];
  };
  return { scene, sleeve, state, press, end, third };
}

/** (290, 120) turned by `TURN` about joint b at (200, 150). */
const BENT = [
  200 + 90 * Math.cos(TURN) + 30 * Math.sin(TURN),
  150 + 90 * Math.sin(TURN) - 30 * Math.cos(TURN),
];

describe('a rig bound with the weight tool\'s state', () => {
  it('bends a path by a stroke as it is painted', () => {
    const t = setup();
    t.state.setActive('b');
    expect(t.third()).toBeUndefined();
    const handle = t.press(290, 120);
    expect(t.scene.get(t.sleeve)!.data.skin).toBeUndefined();
    expect(t.third()![0]).toBeCloseTo(BENT[0], 3);
    expect(t.third()![1]).toBeCloseTo(BENT[1], 3);
    t.end(handle, 'commit');
    expect(t.scene.get(t.sleeve)!.data.skin).toEqual({ b: [0, 0, 1, 0] });
    expect(t.third()![0]).toBeCloseTo(BENT[0], 3);
  });

  it('goes back to the document\'s weights when the stroke is canceled', () => {
    const t = setup();
    t.state.setActive('b');
    const handle = t.press(290, 120);
    expect(t.third()).toBeDefined();
    t.end(handle, 'cancel');
    expect(t.third()).toBeUndefined();
  });
});
