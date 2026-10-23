/**
 * The select tool's drag gestures (move, resize, rotate, area-select) fire the
 * right action when `<SceneCanvas>` is fully mounted.
 *
 * - Under jsdom `getBoundingClientRect()` returns all-zeros, so clientX ==
 *   worldX at scale=1, view.x=0.
 * - `DEFAULT_ROTATION_HANDLE_DISTANCE = 24`, so the rotate handle for a node
 *   at `{x:0, y:0, w:50, h:50}` sits at world `(25, -24)`.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import type { ActionDisabledReason } from '@weasel-js/routing';
import type { Contribution } from '../tools/overlayBinding';
import { areaSelectContribution } from '../tools/builtin/select/selectionContributions';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

/** Make a scene with one rect node at {x:0, y:0, width:50, height:50}. */
function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({
      kind: 'mark',
      data: { kind: 'rect' },
      layer: 'main' as L,
      pose: { x: 0, y: 0, width: 50, height: 50 } as P,
    });
  });
  return s;
}

/** Get the first node id from the scene's renderOrder. */
function firstId(scene: Scene<D, L, P>): NodeId {
  for (const id of scene.renderOrder()) return id;
  throw new Error('No nodes in scene');
}

/** Fire a pointer gesture sequence on a canvas element:
 *  pointerdown → pointermove (past threshold) → pointerup. */
function gesture(
  canvas: HTMLCanvasElement,
  {
    downX, downY,
    moveX = downX + 10, moveY = downY,
  }: { downX: number; downY: number; moveX?: number; moveY?: number },
): void {
  canvas.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: downX, clientY: downY, pointerId: 1 }),
  );
  canvas.dispatchEvent(
    new PointerEvent('pointermove', { bubbles: true, clientX: moveX, clientY: moveY, pointerId: 1 }),
  );
  canvas.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, clientX: moveX, clientY: moveY, pointerId: 1 }),
  );
}

/** move/resize/rotate have a static `SelectionRequired` placeholder for
 *  `enabled()`; this bypasses the gate. */
const FORCE_ENABLED: { enabled: () => true | ActionDisabledReason } = { enabled: () => true };

describe('integration: SceneCanvas + useSelectTool drag routes', () => {

  it('affordanceAt returns a handle hit near a corner of the selected node', () => {
    const scene = makeScene();
    const id = firstId(scene);

    // The node's top-left corner handle is at world (0, 0).
    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        selectionOptions={{ initial: [id] }}
        actions={{ resize: FORCE_ENABLED }}
      />,
    );

    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('No canvas element');

    const batchSpy = vi.spyOn(scene, 'applyBatch');

    act(() => {
      gesture(canvas, { downX: 0, downY: 0, moveX: 20, moveY: 0 });
    });

    // resizeAction commits via scene.applyBatch(ops, 'Resize', adapter) on onEnd.
    const resizeCalls = batchSpy.mock.calls.filter(
      ([, label]) => label === 'Resize',
    );
    expect(resizeCalls.length).toBeGreaterThanOrEqual(1);

    // After dragging right 20px from the top-left handle, the node should
    // have moved its left edge right (x increased).
    const finalPose = scene.get(id)?.pose as P | undefined;
    expect(finalPose).toBeDefined();
    if (finalPose) {
      expect(finalPose.x).not.toBe(0);
    }

    batchSpy.mockRestore();
  });

  it('drag on rotate handle fires rotateAction → scene.applyBatch(..., "Rotate", ...)', () => {
    const scene = makeScene();
    const id = firstId(scene);

    // The rotation handle sits at clientY = -24, which is off-canvas; jsdom
    // doesn't clip client coords, so the press still lands.
    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        selectionOptions={{ initial: [id] }}
        actions={{ rotate: FORCE_ENABLED }}
      />,
    );

    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('No canvas element');

    const batchSpy = vi.spyOn(scene, 'applyBatch');

    act(() => {
      // Down at rotate handle position (25, -24), move right 10px.
      gesture(canvas, { downX: 25, downY: -24, moveX: 35, moveY: -24 });
    });

    // rotateAction commits via scene.applyBatch(ops, 'Rotate', adapter) on onEnd.
    const rotateCalls = batchSpy.mock.calls.filter(
      ([, label]) => label === 'Rotate',
    );
    expect(rotateCalls.length).toBeGreaterThanOrEqual(1);

    batchSpy.mockRestore();
  });

  describe('a plain drag on empty canvas with no select tool', () => {
    function dragEmpty(ambient: Contribution[]) {
      const scene = makeScene();
      const spy = vi.fn();
      const { container } = render(
        <SceneCanvas features={['pick']}
          scene={scene}
          layers={{}}
          width={200}
          height={200}
          tools={{ select: false }}
          ambient={ambient}
          actions={{
            areaSelect: {
              id: 'areaSelect',
              label: 'Area Select',
              enabled: () => true as const,
              invoker: { timing: 'ongoing', start: () => { spy(); return { onEnd: () => {} }; } },
            },
          }}
        />,
      );
      const canvas = container.querySelector('canvas');
      if (!canvas) throw new Error('No canvas element');
      act(() => gesture(canvas, { downX: 150, downY: 150, moveX: 170, moveY: 150 }));
      return spy;
    }

    it('selects nothing by default', () => {
      expect(dragEmpty([])).not.toHaveBeenCalled();
    });

    it('marquees when the canvas opts in with areaSelectContribution', () => {
      expect(dragEmpty([areaSelectContribution()])).toHaveBeenCalledTimes(1);
    });
  });

  describe('selectTool.rotate', () => {
    type RP = P & { rotation?: number };

    function mount(scene: Scene<D, L, P>, rotate: object, initial: NodeId[]) {
      const { container } = render(
        <SceneCanvas features={['draw']}
          scene={scene}
          layers={{}}
          width={200}
          height={200}
          selectionOptions={{ initial }}
          actions={{ rotate: FORCE_ENABLED }}
          selectTool={{ rotate }}
        />,
      );
      const canvas = container.querySelector('canvas');
      if (!canvas) throw new Error('No canvas element');
      return canvas;
    }

    /** A quarter turn of the handle over a 50×50 rect at the origin. */
    const quarterTurn = { downX: 25, downY: -24, moveX: 74, moveY: 25 };

    it('names the history entry with rotateLabel', () => {
      const scene = makeScene();
      const canvas = mount(scene, { rotateLabel: 'Spin' }, [firstId(scene)]);
      const batchSpy = vi.spyOn(scene, 'applyBatch');
      act(() => gesture(canvas, quarterTurn));
      expect(batchSpy.mock.calls.map(([, label]) => label)).toContain('Spin');
    });

    it('fires onGestureStart with the rotated ids and onGestureEnd(true) once', () => {
      const scene = makeScene();
      const id = firstId(scene);
      const onGestureStart = vi.fn();
      const onGestureEnd = vi.fn();
      const canvas = mount(scene, { onGestureStart, onGestureEnd }, [id]);
      act(() => gesture(canvas, quarterTurn));
      expect(onGestureStart).toHaveBeenCalledTimes(1);
      expect(onGestureStart).toHaveBeenCalledWith([id]);
      expect(onGestureEnd).toHaveBeenCalledTimes(1);
      expect(onGestureEnd).toHaveBeenCalledWith(true);
    });

    it("runs behaviors, whose onMove pose sets the committed rotation", () => {
      const scene = makeScene();
      const id = firstId(scene);
      const snap = { onMove: (_ctx: unknown, proposed: { pose: RP }) => ({ pose: { ...proposed.pose, rotation: 0.25 } }) };
      const canvas = mount(scene, { behaviors: [snap] }, [id]);
      act(() => gesture(canvas, quarterTurn));
      expect((scene.get(id)!.pose as RP).rotation).toBeCloseTo(0.25);
    });

    it('commits without an undo entry when transient', () => {
      const scene = makeScene();
      const id = firstId(scene);
      const canvas = mount(scene, { transient: true }, [id]);
      const before = scene.historyEntries().length;
      act(() => gesture(canvas, quarterTurn));
      expect((scene.get(id)!.pose as RP).rotation ?? 0).not.toBe(0);
      expect(scene.historyEntries().length).toBe(before);
    });

    it("turns each node about its own center under pivot: 'each'", () => {
      const scene = makeScene();
      scene.batch('seed', () => {
        scene.add({
          kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
          pose: { x: 100, y: 0, width: 50, height: 50 } as P,
        });
      });
      const ids = [...scene.renderOrder()];
      // The handle sits above the union's top center, (75, -24).
      const canvas = mount(scene, { pivot: 'each' }, ids);
      act(() => gesture(canvas, { downX: 75, downY: -24, moveX: 150, moveY: 25 }));
      const poses = ids.map((i) => scene.get(i)!.pose as RP);
      expect(poses.every((p) => (p.rotation ?? 0) !== 0)).toBe(true);
      expect(poses.map((p) => [p.x, p.y])).toEqual([[0, 0], [100, 0]]);
    });
  });

  it('drag routes through moveAction under SceneCanvas (dispatcher always mounted)', () => {
    const scene = makeScene();
    const id = firstId(scene);

    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        selectionOptions={{ initial: [id] }}
        actions={{ move: FORCE_ENABLED }}
      />,
    );

    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('No canvas element');

    const batchSpy = vi.spyOn(scene, 'applyBatch');

    act(() => {
      gesture(canvas, { downX: 25, downY: 25, moveX: 45, moveY: 25 });
    });

    const moveBatches = batchSpy.mock.calls.filter(([, label]) => label === 'Move');
    expect(moveBatches).toHaveLength(1);
    // Should NOT see a 'Transform' commit (that's the old useMove path).
    const transformBatches = batchSpy.mock.calls.filter(([, label]) => label === 'Transform');
    expect(transformBatches).toHaveLength(0);

    batchSpy.mockRestore();
  });
});
