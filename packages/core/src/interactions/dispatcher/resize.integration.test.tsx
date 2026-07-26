/**
 * End-to-end integration test for resizeAction via dispatcher.
 *
 * Validates the full affordance→InvocationCtx→invoker→scene-mutation chain:
 *
 *   pointerdown (with affordance hit) → affordanceAt thunk called → affordance
 *   packed into InputEvent → dispatcher builds InvocationCtx with
 *   drag.affordance → resizeAction.invoker.start guards pass → onMove called
 *   on pointermove → scene node bounds updated → pointerup → onEnd('commit').
 *
 * Also validates:
 *   - pointerdown without a matching affordance → resizeAction bails (other
 *     bindings can claim the drag; here nothing else is registered so the
 *     drag is a no-op).
 *   - pointercancel → onEnd('cancel') → poses restored to origin.
 *
 * ## Provider tree
 *
 * DepRegistryProvider > ActiveToolContextProvider
 *   > ActionsProvider > [MountDispatcher + RegisterDeps + RegisterResize]
 *
 * `resizeAction` is registered with `enabled: () => true` to bypass the
 * `ActionDisabledReason.SelectionRequired` placeholder.
 *
 * `affordanceAt` is supplied as a stub thunk: if the pointerdown x coordinate
 * equals a sentinel value (999), return a `handle:bottom-right` hit with
 * fixedPoint {x:0, y:0}; otherwise return null.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider, useDepRegistry } from '../actions/depRegistry';
import '../actions/depSchema'; // augments DepSchema with 'selection' and 'scene'
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import { resizeAction } from '../actions/defaults/resize';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { AffordanceHit } from '../actions/invoker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

// ---------------------------------------------------------------------------
// Canvas mock (required for JSDOM which lacks canvas context)
// ---------------------------------------------------------------------------

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

// ---------------------------------------------------------------------------
// Stub affordanceAt thunk
// ---------------------------------------------------------------------------

/**
 * Returns a `handle:bottom-right` hit when `clientX === HANDLE_X` (the
 * sentinel that means "pointer landed on the bottom-right handle").
 * Returns `null` for any other coordinate (open canvas).
 */
const HANDLE_X = 999; // sentinel clientX that means "on handle"

function makeAffordanceAt(
  nodeIds: string[],
): (pt: { x: number; y: number }) => AffordanceHit | null {
  return (pt) => {
    if (pt.x === HANDLE_X) {
      return {
        kind: 'handle:bottom-right',
        fixedPoint: { x: 0, y: 0 },
        targetIds: nodeIds,
        // Typed anchor. bottom-right dragged → top-left fixed.
        anchor: { x: 'min', y: 'min' },
      };
    }
    return null;
  };
}

// ---------------------------------------------------------------------------
// Test harness components
// ---------------------------------------------------------------------------

/** Mounts the gesture dispatcher on the canvas element with the stub thunk. */
function MountDispatcher({
  canvasRef,
  affordanceAt,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  affordanceAt?: (pt: { x: number; y: number }) => AffordanceHit | null;
}) {
  const registry = useActionsRegistry();
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById: new Map(),
    affordanceAt,
  });
  return <canvas ref={canvasRef} data-testid="canvas" />;
}

/** Registers live dep sources for 'scene' and 'selection'. */
function RegisterDeps({ scene, selection }: { scene: Scene<D, L, P>; selection: SelectionApi }) {
  const registry = useDepRegistry();
  registry.register('scene', () => scene as unknown as Scene<unknown, string, unknown>);
  registry.register('selection', () => selection);
  return null;
}

/** Registers resizeAction with `enabled: () => true`. */
function RegisterResize() {
  const registry = useActionsRegistry();
  if (registry && !registry.list().find((a) => a.id === 'resize')) {
    registry.register({ ...resizeAction, enabled: () => true });
  }
  return null;
}

/** Minimal SelectionApi backed by a plain array. */
function makeSelection(initial: string[]): SelectionApi {
  let ids = initial.map(asNodeId);
  return {
    get current() { return ids; },
    get() { return [...ids]; },
    set(next) { ids = next; },
    add(id) { if (!ids.includes(id)) ids = [...ids, id]; },
    remove(id) { ids = ids.filter((i) => i !== id); },
    toggle(id) { ids.includes(id) ? this.remove(id) : this.add(id); },
    clear() { ids = []; },
    contains(id) { return ids.includes(id); },
    applyClick(id, mods) {
      if (mods.shift || mods.meta || mods.ctrl) {
        this.toggle(id);
      } else {
        ids = [id];
      }
    },
    adapterMethods: {
      getSelection: () => [...ids],
      setSelection: (next) => { ids = next; },
    },
  };
}

/** Fires a synthetic PointerEvent on the canvas element. */
function fire(canvas: HTMLElement, type: string, coords: { clientX?: number; clientY?: number } = {}) {
  canvas.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: coords.clientX ?? 0,
      clientY: coords.clientY ?? 0,
    }),
  );
}

// ---------------------------------------------------------------------------
// Full harness factory
// ---------------------------------------------------------------------------

function buildHarness(
  scene: Scene<D, L, P>,
  selection: SelectionApi,
  nodeIds: string[],
) {
  const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement | null>;
  const affordanceAt = makeAffordanceAt(nodeIds);

  function Harness() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = ref.current;

    return (
      <DepRegistryProvider>
        <ActiveToolContextProvider>
            <ActionsProvider>
              <RegisterDeps scene={scene} selection={selection} />
              <RegisterResize />
              <MountDispatcher canvasRef={ref} affordanceAt={affordanceAt} />
            </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    );
  }

  return Harness;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resizeAction integration via gesture dispatcher', () => {
  it('drag on handle pointerdown→move→up resizes selected node', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({
      kind: 'leaf',
      layer: 'main',
      data: { kind: 'rect' },
      pose: { x: 0, y: 0, width: 100, height: 100 },
    });

    const selection = makeSelection([idA]);
    const Harness = buildHarness(scene, selection, [idA]);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    // Pointerdown at HANDLE_X (sentinel) → affordanceAt returns handle hit.
    act(() => { fire(canvas, 'pointerdown', { clientX: HANDLE_X, clientY: HANDLE_X }); });
    // Move to (HANDLE_X + 20, HANDLE_X + 10) — extend bottom-right by (20, 10).
    act(() => { fire(canvas, 'pointermove', { clientX: HANDLE_X + 20, clientY: HANDLE_X + 10 }); });
    act(() => { fire(canvas, 'pointerup',   { clientX: HANDLE_X + 20, clientY: HANDLE_X + 10 }); });

    const node = scene.get(idA)!;
    const pose = node.pose as P;

    // bottom-right handle: anchor = {x:'min', y:'min'} → right/bottom edges dragged.
    // dx = +20 → width = 100 + 20 = 120
    // dy = +10 → height = 100 + 10 = 110
    // x and y stay fixed (they're on the 'min' side).
    expect(pose.x).toBeCloseTo(0);
    expect(pose.y).toBeCloseTo(0);
    expect(pose.width).toBeCloseTo(120);
    expect(pose.height).toBeCloseTo(110);
  });

  it('drag on open canvas (no affordance) leaves node unchanged', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({
      kind: 'leaf',
      layer: 'main',
      data: { kind: 'rect' },
      pose: { x: 0, y: 0, width: 100, height: 100 },
    });

    const selection = makeSelection([idA]);
    const Harness = buildHarness(scene, selection, [idA]);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    const versionBefore = scene.getVersion();

    // Pointerdown at clientX=0 → affordanceAt returns null → resize bails.
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 50, clientY: 50 }); });
    act(() => { fire(canvas, 'pointerup',   { clientX: 50, clientY: 50 }); });

    // Scene unchanged.
    expect(scene.getVersion()).toBe(versionBefore);
    const pose = scene.get(idA)!.pose as P;
    expect(pose.width).toBe(100);
    expect(pose.height).toBe(100);
  });

  it('pointercancel during handle drag restores original pose', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({
      kind: 'leaf',
      layer: 'main',
      data: { kind: 'rect' },
      pose: { x: 5, y: 5, width: 80, height: 60 },
    });

    const selection = makeSelection([idA]);
    const Harness = buildHarness(scene, selection, [idA]);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => { fire(canvas, 'pointerdown', { clientX: HANDLE_X, clientY: HANDLE_X }); });
    act(() => { fire(canvas, 'pointermove', { clientX: HANDLE_X + 40, clientY: HANDLE_X + 30 }); });
    // Cancel mid-drag.
    act(() => { fire(canvas, 'pointercancel'); });

    const pose = scene.get(idA)!.pose as P;
    expect(pose.x).toBe(5);
    expect(pose.y).toBe(5);
    expect(pose.width).toBe(80);
    expect(pose.height).toBe(60);
  });

  it('drag on handle with empty selection is a no-op', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({
      kind: 'leaf',
      layer: 'main',
      data: { kind: 'rect' },
      pose: { x: 0, y: 0, width: 100, height: 100 },
    });

    const selection = makeSelection([]); // empty selection
    const Harness = buildHarness(scene, selection, [idA]);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    const versionBefore = scene.getVersion();

    act(() => { fire(canvas, 'pointerdown', { clientX: HANDLE_X, clientY: HANDLE_X }); });
    act(() => { fire(canvas, 'pointermove', { clientX: HANDLE_X + 20, clientY: HANDLE_X + 20 }); });
    act(() => { fire(canvas, 'pointerup',   { clientX: HANDLE_X + 20, clientY: HANDLE_X + 20 }); });

    expect(scene.getVersion()).toBe(versionBefore);
  });
});
