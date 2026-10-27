/**
 * The select tool on a 3D `<SceneCanvas>` treats containers as 2D does: a click on a nested
 * solid selects its outermost container, a double-click enters it, and a click inside then
 * selects the next level in.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, createEnteredGroup, useSelection, type EnteredGroupApi, type SelectionApi } from '@weasel-js/core';
import { createCamera, type Camera3d } from './camera';
import type { Camera3dDep } from './cameraDep';
import { homeAction } from './tools';
import { createNodeAtPoint, createPoseDescriptor, worldPoseOf } from './deps';
import { aabbOfPose } from './pose3';
import { projectPoint, type Viewport3d } from './project';
import { boundsOfTestNode, createNestedTestScene } from './testScene';
import type { World3d } from './world';
import type { TestData, TestLayer } from './testScene';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

const W = 800;
const H = 600;

function setup() {
  const { scene, root, outer, inner, deep } = createNestedTestScene();
  const viewport = (): Viewport3d => ({
    camera: createCamera({ distance: 14, pitch: 0.5, yaw: 0.4, target: { x: 0.5, y: 0.5, z: -1 } }),
    width: W,
    height: H,
  });
  const world: World3d<TestData, TestLayer> = { scene, viewport, bounds: boundsOfTestNode };
  const nodeAtPoint = createNodeAtPoint(world);
  const pickEvery = (p: { x: number; y: number }) => nodeAtPoint(p);
  const poseDescriptor = createPoseDescriptor(world);
  const entered: EnteredGroupApi = createEnteredGroup(scene as never);
  const home = createCamera({ yaw: 2 });
  const homed = vi.fn();
  const camera3d: Camera3dDep = {
    get: () => viewport().camera,
    set: (c: Camera3d) => { homed(c); },
    size: () => ({ width: W, height: H }),
    home: () => home,
  };
  const cameraRig = {
    id: 'camera3d', eligibility: { always: true }, actions: [homeAction], deps: { camera3d: () => camera3d },
  };
  let sel!: SelectionApi;
  function Canvas() {
    sel = useSelection({ mode: 'multi' });
    return (
      <SceneCanvas scene={scene} layers={{}} width={W} height={H} selection={sel} features={['pick']}
        enteredGroup={entered} poseDescriptor={poseDescriptor} geometry={{ pickEvery }} ambient={[cameraRig]} />
    );
  }
  const { container } = render(<Canvas />);
  const canvas = container.querySelector('canvas')!;
  const screenOf = (id: string) => {
    const b = aabbOfPose(worldPoseOf(scene, id as never)!);
    const c = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 };
    return projectPoint(c, viewport())!;
  };
  const press = (p: { x: number; y: number }) => act(() => {
    for (const type of ['pointerdown', 'pointerup']) {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, clientX: p.x, clientY: p.y, pointerId: 1, button: 0, buttons: 1,
      }));
    }
  });
  const doubleClick = (p: { x: number; y: number }) => { press(p); press(p); };
  return {
    ids: { root, outer, inner, deep }, entered, homed, press, doubleClick, screenOf,
    selection: () => [...sel.current],
  };
}

describe('containers under the select tool, in 3D', () => {
  it('a click on a solid two containers deep selects the outermost container', () => {
    const t = setup();
    expect(t.screenOf(t.ids.deep)).not.toBeNull();
    t.press(t.screenOf(t.ids.deep));
    expect(t.selection()).toEqual([t.ids.outer]);
  });

  it('a click on a solid at the root selects the solid', () => {
    const t = setup();
    t.press(t.screenOf(t.ids.root));
    expect(t.selection()).toEqual([t.ids.root]);
  });

  it('a double-click enters the outermost container, and a click then selects the next level in', () => {
    const t = setup();
    t.doubleClick(t.screenOf(t.ids.deep));
    expect(t.entered.get()).toBe(t.ids.outer);
    t.press(t.screenOf(t.ids.deep));
    expect(t.selection()).toEqual([t.ids.inner]);
  });

  it('a double-click on a container enters it rather than sending the camera home, and on empty space homes', () => {
    const t = setup();
    t.doubleClick(t.screenOf(t.ids.deep));
    expect(t.homed).not.toHaveBeenCalled();
    t.doubleClick({ x: 2, y: 2 });
    expect(t.homed).toHaveBeenCalledOnce();
  });

  it('a second double-click enters the inner container, and a click then selects the solid', () => {
    const t = setup();
    t.doubleClick(t.screenOf(t.ids.deep));
    t.doubleClick(t.screenOf(t.ids.deep));
    expect(t.entered.get()).toBe(t.ids.inner);
    t.press(t.screenOf(t.ids.deep));
    expect(t.selection()).toEqual([t.ids.deep]);
  });

  it('a click on a solid outside the entered container leaves it', () => {
    const t = setup();
    t.doubleClick(t.screenOf(t.ids.deep));
    t.press(t.screenOf(t.ids.root));
    expect(t.entered.get()).toBeNull();
  });
});
