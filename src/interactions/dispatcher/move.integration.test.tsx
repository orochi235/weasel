/**
 * Phase 6 Task 4 — end-to-end integration test for moveAction via dispatcher.
 *
 * Proves the full drag pump chain:
 *   pointerdown → match drag binding → start
 *   pointermove×N → onMove × N
 *   pointerup → onEnd('commit') → scene mutated by cumulative delta
 *
 * Also validates:
 *   - pointercancel → onEnd('cancel') → no scene mutation
 *   - empty selection → no-op (no scene mutation)
 *
 * ## Provider tree
 *
 * The test mounts the same provider tree used by the real app:
 *   DepRegistryProvider > ActiveToolContextProvider
 *     > ActionsProvider > [MountDispatcher + RegisterDeps + RegisterMove]
 *
 * `moveAction` is registered with `enabled: () => true` to bypass the
 * `ActionDisabledReason.SelectionRequired` placeholder that moveAction ships
 * with (Phase 7 TODO: wire live enabled state). The drag pump itself — start,
 * onMove, onEnd — is what this test validates.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider, useDepRegistry } from '../actions/depRegistry';
import '../actions/depSchema'; // augments DepSchema with 'selection' and 'scene'
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import { moveAction } from '../actions/defaults/move';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

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
// Test harness components
// ---------------------------------------------------------------------------

/** Mounts the gesture dispatcher on the canvas element.
 *  `moveAction`'s ambient binding is `{ kind: 'drag', target: 'selected-body' }`,
 *  so the harness has to mark every drag as landing on the selection — we
 *  do that with a constant `classifyTarget` thunk. Real apps source this
 *  from a selection-aware hit test (see SceneCanvas). */
function MountDispatcher({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const registry = useActionsRegistry();
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById: new Map(),
    classifyTarget: () => 'selected-body',
  });
  return <canvas ref={canvasRef} data-testid="canvas" />;
}

/** Registers live dep sources for 'scene' and 'selection'. */
function RegisterDeps({ scene, selection }: { scene: Scene<D, L, P>; selection: SelectionApi }) {
  const registry = useDepRegistry();
  // Cast through the DepRegistry's typed contract. The test imports depSchema so
  // 'scene' and 'selection' are valid DepName entries; the scene generic is erased
  // to the depSchema form (Scene<unknown, string, unknown>) at this boundary.
  registry.register('scene', () => scene as unknown as Scene<unknown, string, unknown>);
  registry.register('selection', () => selection);
  return null;
}

/** Registers moveAction with `enabled: () => true` so the dispatcher doesn't
 *  gate on SelectionRequired (Phase 7 TODO). */
function RegisterMove() {
  const registry = useActionsRegistry();
  if (registry && !registry.list().find((a) => a.id === 'move')) {
    registry.register({ ...moveAction, enabled: () => true });
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

function buildHarness(scene: Scene<D, L, P>, selection: SelectionApi) {
  const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement | null>;

  function Harness() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    // Keep the outer ref in sync so callers can dispatch events.
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = ref.current;

    return (
      <DepRegistryProvider>
        <ActiveToolContextProvider>
            <ActionsProvider>
              <RegisterDeps scene={scene} selection={selection} />
              <RegisterMove />
              <MountDispatcher canvasRef={ref} />
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

describe('moveAction integration via gesture dispatcher', () => {
  it('drag pointerdown→move→up translates selected nodes by delta', () => {
    // Build scene with two nodes at (0,0) and (100,0).
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'leaf', layer: 'main', data: { kind: 'rect' }, pose: { x: 0, y: 0, width: 50, height: 50 } });
    const idB = scene.add({ kind: 'leaf', layer: 'main', data: { kind: 'rect' }, pose: { x: 100, y: 0, width: 50, height: 50 } });

    const selection = makeSelection([idA, idB]);
    const Harness = buildHarness(scene, selection);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    // Simulate drag: down at (0,0), move to (20,10), up at (20,10).
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 20, clientY: 10 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 20, clientY: 10 }); });

    const nodeA = scene.get(idA)!;
    const nodeB = scene.get(idB)!;

    expect((nodeA.pose as P).x).toBe(20);
    expect((nodeA.pose as P).y).toBe(10);
    expect((nodeB.pose as P).x).toBe(120);
    expect((nodeB.pose as P).y).toBe(10);
  });

  it('drag cancelled mid-gesture restores original poses (verify cancel path)', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'leaf', layer: 'main', data: { kind: 'rect' }, pose: { x: 5, y: 5, width: 50, height: 50 } });

    const selection = makeSelection([idA]);
    const Harness = buildHarness(scene, selection);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 30, clientY: 15 }); });
    // Cancel before up — scene should stay at original poses.
    act(() => { fire(canvas, 'pointercancel'); });

    const nodeA = scene.get(idA)!;
    expect((nodeA.pose as P).x).toBe(5);
    expect((nodeA.pose as P).y).toBe(5);
  });

  it('drag with empty selection is a no-op (no scene mutation)', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'leaf', layer: 'main', data: { kind: 'rect' }, pose: { x: 10, y: 10, width: 50, height: 50 } });

    const selection = makeSelection([]); // empty
    const Harness = buildHarness(scene, selection);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    const versionBefore = scene.getVersion();

    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 50, clientY: 50 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 50, clientY: 50 }); });

    // Scene version must not have advanced (no mutations).
    expect(scene.getVersion()).toBe(versionBefore);
    const nodeA = scene.get(idA)!;
    expect((nodeA.pose as P).x).toBe(10);
    expect((nodeA.pose as P).y).toBe(10);
  });
});
