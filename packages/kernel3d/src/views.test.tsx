/**
 * Two 3D views side by side on one `<SceneCanvas>`, each through its own
 * camera: a press, a double-click or a hover in either picks what that view's
 * camera sees there, and a drag moves on that camera's ground.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  SceneCanvas, createEnteredGroup, useSelection, type CanvasViewProps, type NodeId, type SelectionApi,
} from '@weasel-js/core';
import { createCamera, type Camera3d } from './camera';
import { createNodeAtPoint, createPickEvery, createPoseDescriptor, worldPoseOf } from './deps';
import { projectPoint, type Viewport3d } from './project';
import { boundsOfTestNode, createNestedTestScene, createTestScene, type TestScene } from './testScene';
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
const HALF = W / 2;

type ViewName = 'left' | 'right';
const RECTS: Record<ViewName, { x: number; y: number; w: number; h: number }> = {
  left: { x: 0, y: 0, w: HALF, h: H },
  right: { x: HALF, y: 0, w: HALF, h: H },
};

/** `scene` on a canvas split into two views, each camera aimed at a different
 *  node, so the middle of each pane shows a different one. */
function setup(scene: TestScene, aim: Record<ViewName, NodeId>) {
  const cameras: Record<ViewName, Camera3d> = {
    left: createCamera({ distance: 8, pitch: 0.4, target: worldPoseOf(scene, aim.left)!.position }),
    right: createCamera({ distance: 5, pitch: 0.4, yaw: 0.3, target: worldPoseOf(scene, aim.right)!.position }),
  };
  // A view's input arrives view-local, through its identity camera, so its
  // pane sits at the origin.
  const viewport = (viewId?: string | null): Viewport3d => ({
    camera: cameras[viewId === 'right' ? 'right' : 'left'], width: HALF, height: H,
  });
  const world: World3d<TestData, TestLayer> = { scene, viewport, bounds: boundsOfTestNode };
  const viewProps = (id: ViewName): CanvasViewProps => ({
    id, bounds: RECTS[id],
    deps: { nodeAtPoint: createNodeAtPoint(world, id), poseDescriptor: createPoseDescriptor(world, id) },
  });

  const entered = createEnteredGroup(scene as never);
  const hovered: (string | null)[] = [];
  let sel!: SelectionApi;
  function Canvas() {
    sel = useSelection({ mode: 'multi' });
    return (
      <SceneCanvas scene={scene} layers={{}} width={W} height={H} selection={sel} features={['pick', 'select', 'move']}
        enteredGroup={entered} onHover={(id) => hovered.push(id)}
        poseDescriptor={createPoseDescriptor(world)} geometry={{ pickEvery: createPickEvery(world) }}
        views={[viewProps('left'), viewProps('right')]} />
    );
  }
  const { container } = render(<Canvas />);
  const canvas = container.querySelector('canvas')!;

  /** Where `id`'s center draws on the canvas, through view `view`. */
  const clientOf = (view: ViewName, id: string) => {
    const p = projectPoint(worldPoseOf(scene, id as never)!.position, viewport(view))!;
    return { x: p.x + RECTS[view].x, y: p.y + RECTS[view].y };
  };
  const pointer = (type: string, p: { x: number; y: number }, buttons = 1) => act(() => {
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, clientX: p.x, clientY: p.y, pointerId: 1, button: 0, buttons,
    }));
  });
  const press = (p: { x: number; y: number }) => {
    pointer('pointerdown', p);
    pointer('pointerup', p, 0);
  };
  return {
    world, clientOf, press, pointer, entered, hovered,
    doubleClick: (p: { x: number; y: number }) => { press(p); press(p); },
    selection: () => [...sel.current],
  };
}

function solids() {
  const scene = createTestScene();
  const [a, b, c] = [...scene.renderOrder()] as [NodeId, NodeId, NodeId];
  return { scene, ids: { a, b, c }, ...setup(scene, { left: b, right: c }) };
}

describe('two 3D views on one surface', () => {
  it('aims the two cameras at different solids', () => {
    const t = solids();
    // Where the second camera draws `c`, the first draws something else.
    const there = t.clientOf('right', t.ids.c);
    const firstSees = createNodeAtPoint(t.world, 'left')({ x: there.x - HALF, y: there.y });
    expect(firstSees).not.toBe(t.ids.c);
  });

  it('a press in the second view selects what its camera sees, not what the first sees there', () => {
    const t = solids();
    t.press(t.clientOf('right', t.ids.c));
    expect(t.selection()).toEqual([t.ids.c]);
  });

  it('a press in the first view selects through the first camera', () => {
    const t = solids();
    t.press(t.clientOf('left', t.ids.b));
    expect(t.selection()).toEqual([t.ids.b]);
  });

  it('a drag in the second view moves the solid along that camera\'s ground', () => {
    const t = solids();
    const from = t.clientOf('right', t.ids.c);
    const before = worldPoseOf(t.scene, t.ids.c)!.position;
    t.pointer('pointerdown', from);
    for (let i = 1; i <= 4; i++) t.pointer('pointermove', { x: from.x + 10 * i, y: from.y });
    t.pointer('pointerup', { x: from.x + 40, y: from.y }, 0);
    const after = worldPoseOf(t.scene, t.ids.c)!.position;
    // Kept its height, and landed back under the pointer in the right view. The
    // drag carries the projected box's center, a pixel off the projected position.
    expect(after.y).toBeCloseTo(before.y, 6);
    const landed = t.clientOf('right', t.ids.c);
    expect(Math.abs(landed.x - (from.x + 40))).toBeLessThan(2);
    expect(Math.abs(landed.y - from.y)).toBeLessThan(2);
  });

  it('a hover in the second view names what its camera sees', () => {
    const t = solids();
    t.pointer('pointermove', t.clientOf('right', t.ids.c), 0);
    expect(t.hovered.at(-1)).toBe(t.ids.c);
  });

  it('a double-click in the second view enters the container its camera sees', () => {
    const scene = createNestedTestScene();
    const t = setup(scene.scene, { left: scene.root, right: scene.deep });
    t.doubleClick(t.clientOf('right', scene.deep));
    expect(t.entered.get()).toBe(scene.outer);
  });
});
