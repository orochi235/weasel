/**
 * SceneCanvas + useSelectTool integration — Phase 13 drag-route migration.
 *
 * Verifies that the four drag gestures (move, resize, rotate, area-select)
 * fire the correct action descriptor when `<SceneCanvas>` is fully mounted
 * with the auto-wired `affordanceAt` + `classifyTarget` thunks.
 *
 * ## jsdom constraints
 *
 * - `getBoundingClientRect()` returns all-zeros, so clientX == worldX at
 *   scale=1, view.x=0.
 * - `DEFAULT_ROTATION_HANDLE_DISTANCE = 24`, so the rotate handle for a node
 *   at `{x:0, y:0, w:50, h:50}` sits at world `(25, -24)`.
 * - Pointer events are fired on the canvas element obtained from `container`.
 *
 * ## Gesture sequence
 *
 * For each test:
 *   1. Simulate pointerdown at the relevant world location.
 *   2. Simulate pointermove past the 4px threshold.
 *   3. Simulate pointerup.
 *   4. Assert the correct scene-side effect.
 *
 * ## What this does NOT test
 *
 * - Live overlay / ghost rendering (no overlay wiring in the descriptor path yet).
 * - `areaSelectAction` — the `areaSelect` dep is not registered by default in
 *   `useStandardActions`; wiring it is a Phase 14 TODO. The binding exists on
 *   `useSelectTool` and `matchSpec` can reach it — the gap is the missing dep.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import type { ActionDisabledReason } from 'interactions/actions/registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

// ---------------------------------------------------------------------------
// jsdom setup
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a scene with one rect node at {x:0, y:0, width:50, height:50}. */
function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({
      kind: 'leaf',
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

/** Enable gate override for move/resize/rotate — these have a static `SelectionRequired`
 *  placeholder for `enabled()` because the predicate can't read live deps today
 *  (Phase 7 TODO). Pass `enabled: () => true` to bypass the gate in tests. */
const FORCE_ENABLED: { enabled: () => true | ActionDisabledReason } = { enabled: () => true };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 13 integration: SceneCanvas + useSelectTool drag routes', () => {

  // --------------------------------------------------------------------------
  // Thread 1 + Thread 3 smoke: affordanceAt + classifyTarget wiring
  // --------------------------------------------------------------------------

  it('affordanceAt returns a handle hit near a corner of the selected node', () => {
    // Verify the affordanceAt thunk fires and resizeAction commits.
    // Phase 14e Task 4: with `useResizeTool` deleted, resize flows entirely
    // through the dispatcher-side `resizeAction`, which gates on
    // `SelectionRequired` by default — override to bypass the static
    // placeholder gate. resizeAction commits on `onEnd` via `scene.batch`.
    const scene = makeScene();
    const id = firstId(scene);

    // Node is at {x:0, y:0, w:50, h:50}.
    // Corner handles are at the four corners. Top-left = (0, 0) in world.
    // With jsdom getBoundingClientRect → all zeros, worldX = clientX.
    // Hit radius = 8, so clicking at (0,0) should hit the top-left handle.
    const { container } = render(
      <SceneCanvas
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

    const batchSpy = vi.spyOn(scene, 'batch');

    act(() => {
      gesture(canvas, { downX: 0, downY: 0, moveX: 20, moveY: 0 });
    });

    // resizeAction commits via scene.batch('Resize', ...) on onEnd.
    const resizeCalls = batchSpy.mock.calls.filter(
      ([label]) => label === 'Resize',
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

  it('drag on selected body fires moveAction → scene.batch("Move", ...)', () => {
    const scene = makeScene();
    const id = firstId(scene);

    // Node at {x:0, y:0, w:50, h:50}. Center = (25, 25).
    // Click at (25, 25) — inside the node body, not near a corner handle.
    // selection must be pre-set so classifyTarget returns 'selected-body'.
    //
    // `moveAction.enabled` returns `SelectionRequired` (static placeholder, Phase 7 TODO).
    // Override to `() => true` so the dispatcher doesn't gate it.
    const { container } = render(
      <SceneCanvas
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

    const batchSpy = vi.spyOn(scene, 'batch');

    act(() => {
      // Down at body center, move right 20px.
      gesture(canvas, { downX: 25, downY: 25, moveX: 45, moveY: 25 });
    });

    // moveAction commits via scene.batch('Move', ...) on onEnd.
    const moveCalls = batchSpy.mock.calls.filter(
      ([label]) => label === 'Move',
    );
    expect(moveCalls.length).toBeGreaterThanOrEqual(1);

    batchSpy.mockRestore();
  });

  it('drag on empty space fires areaSelectAction binding (action exists in registry)', () => {
    // Verify the areaSelect binding exists on useSelectTool and the action is
    // registered. The dep (areaSelect) isn't in the dep registry by default
    // today, so the action doesn't complete — but we verify it's reached by
    // overriding the action's invoker with a spy.
    const scene = makeScene();
    const areaSelectSpy = vi.fn();

    // Override areaSelect action to use a spy invoker so we can detect the binding fired.
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        actions={{
          areaSelect: {
            id: 'areaSelect',
            label: 'Area Select',
            defaultBinding: { kind: 'drag' },
            // Always enabled so the dispatcher doesn't gate it.
            enabled: () => true as true,
            // Return a non-empty handle so the dispatcher records the
            // engagement instead of falling through to a sibling binding —
            // the test asserts the spy fires once, not that the binding
            // matched on every linked spec.
            invoker: { timing: 'ongoing', start: () => { areaSelectSpy(); return { onEnd: () => {} }; } },
          },
        }}
      />,
    );

    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('No canvas element');

    act(() => {
      // No selection → click at (200, 200) which is outside the node (0,0,50,50).
      // classifyTarget → 'empty'. areaSelect binding should fire.
      gesture(canvas, { downX: 150, downY: 150, moveX: 170, moveY: 150 });
    });

    expect(areaSelectSpy).toHaveBeenCalledTimes(1);
  });

  it('drag on rotate handle fires rotateAction → scene.batch("Rotate", ...)', () => {
    const scene = makeScene();
    const id = firstId(scene);

    // Rotation handle for a node at {x:0, y:0, w:50, h:50}:
    //   Top-center = (25, 0), handle offset = -24 → worldY = -24.
    //   clientY = worldY at scale=1, view.y=0 → clientY = -24.
    // But clientY = -24 is off-canvas; the test still works because the
    // dispatcher fires based on client coords which the affordanceAt thunk
    // converts to world. jsdom doesn't clip client coords.
    //
    // `rotateAction.enabled` returns `SelectionRequired` (static placeholder).
    // Override to `() => true` so the dispatcher doesn't gate it.
    const { container } = render(
      <SceneCanvas
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

    const batchSpy = vi.spyOn(scene, 'batch');

    act(() => {
      // Down at rotate handle position (25, -24), move right 10px.
      gesture(canvas, { downX: 25, downY: -24, moveX: 35, moveY: -24 });
    });

    // rotateAction commits via scene.batch('Rotate', ...) on onEnd.
    const rotateCalls = batchSpy.mock.calls.filter(
      ([label]) => label === 'Rotate',
    );
    expect(rotateCalls.length).toBeGreaterThanOrEqual(1);

    batchSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // Thread 2: bindingsOverrideDrag flag
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // Phase 14a: clearSelection via click binding
  // --------------------------------------------------------------------------

  it('click on empty (no mods) clears selection via clearSelectionAction binding', () => {
    const scene = makeScene();
    const id = firstId(scene);

    // Start with the node selected.
    let selectionState: NodeId[] = [id];
    const selectionApi = {
      get current() { return selectionState; },
      set: (ids: NodeId[]) => { selectionState = ids; },
      applyClick: (_id: NodeId, _mods: unknown) => {},
      clear: () => { selectionState = []; },
    };

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        selection={selectionApi as any}
      />,
    );

    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('No canvas element');

    // Click on empty space (200, 200) — outside the node at {x:0,y:0,w:50,h:50}.
    // No pointermove → no drag → dispatcher synthesizes a click event.
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 150, clientY: 150, pointerId: 1 }));
      canvas.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 150, clientY: 150, pointerId: 1 }));
    });

    // clearSelectionAction should have fired and cleared the selection.
    expect(selectionState).toEqual([]);
  });

  it('click on empty WITH shift does NOT clear selection (no-op route)', () => {
    const scene = makeScene();
    const id = firstId(scene);

    let selectionState: NodeId[] = [id];
    const selectionApi = {
      get current() { return selectionState; },
      set: (ids: NodeId[]) => { selectionState = ids; },
      applyClick: (_id: NodeId, _mods: unknown) => {},
      clear: () => { selectionState = []; },
    };

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        selection={selectionApi as any}
      />,
    );

    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('No canvas element');

    // Shift-click on empty — route table says no-op (not clearSelection).
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 150, clientY: 150, pointerId: 1, shiftKey: true }));
      canvas.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 150, clientY: 150, pointerId: 1, shiftKey: true }));
    });

    // Shift-click on empty preserves selection (route table no-op).
    // Selection should be unchanged.
    expect(selectionState).toEqual([id]);
  });

  it('bindingsOverrideDrag is true under SceneCanvas (dispatcher always mounted)', () => {
    // Indirect verification: the old dispatcher's drag channel is suppressed,
    // meaning the OLD useMove-based drag does NOT fire. Instead, moveAction does.
    // We verify this by confirming the scene.batch label is 'Move' (moveAction's
    // label) not some other label from the old path.
    const scene = makeScene();
    const id = firstId(scene);

    // `moveAction.enabled` returns `SelectionRequired` (static placeholder).
    // Override to `() => true` so the dispatcher doesn't gate it.
    const { container } = render(
      <SceneCanvas
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

    const batchSpy = vi.spyOn(scene, 'batch');

    act(() => {
      gesture(canvas, { downX: 25, downY: 25, moveX: 45, moveY: 25 });
    });

    // With old dispatcher firing: would produce a 'Transform' or 'Move' label
    // from adapter.applyOps (not scene.batch). The new moveAction uses scene.batch('Move').
    // Filter to only 'Move' labels to distinguish from setup batches ('seed', etc.).
    const moveBatches = batchSpy.mock.calls.filter(([label]) => label === 'Move');
    expect(moveBatches).toHaveLength(1);
    // Should NOT see a 'Transform' batch (that's the old useMove path via applyOps).
    const transformBatches = batchSpy.mock.calls.filter(([label]) => label === 'Transform');
    expect(transformBatches).toHaveLength(0);

    batchSpy.mockRestore();
  });
});
