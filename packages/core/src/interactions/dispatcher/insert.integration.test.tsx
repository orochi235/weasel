/**
 * End-to-end integration test for insertAction via dispatcher.
 *
 * Validates the full drag-on-empty chain:
 *   pointerdown (bodyTarget:'empty') → insertAction.invoker.start →
 *   onMove → pointerup → onEnd('commit') → InsertDep.commit(bounds, kind).
 *
 * Uses a self-contained harness (DepRegistryProvider + ActionsProvider +
 * useGestureDispatcher) that mirrors the pattern in resize.integration.test.tsx.
 * Does NOT use SceneCanvas to isolate just the insertAction / InsertDep wiring.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider, useDepRegistry } from '../actions/depRegistry';
import '../actions/depSchema'; // augments DepSchema
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import { insertAction } from '../actions/defaults/insert';
import { createDispatcher, type Dispatcher } from './dispatcher';
import { createGestureSource } from 'canvas/SceneCanvas/dispatcherGestureBounds';
import { unionGestureBounds } from 'canvas/gestureBounds';
import type { InsertDep } from '../actions/depSchema';
import type { NodeId } from 'core/scene/types';

// ---------------------------------------------------------------------------
// Canvas mock (jsdom lacks canvas context)
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
// Stub InsertDep
// ---------------------------------------------------------------------------

function makeInsertDep() {
  const calls: Array<{ bounds: { x: number; y: number; width: number; height: number }; kind: string }> = [];
  const dep: InsertDep = {
    commit(bounds, extras): NodeId | null {
      calls.push({ bounds: { ...bounds }, kind: extras.kind });
      return 'inserted-id' as NodeId;
    },
  };
  return { dep, calls };
}

// ---------------------------------------------------------------------------
// Test harness components
// ---------------------------------------------------------------------------

/**
 * Mounts the gesture dispatcher on the canvas. classifyTarget always returns
 * 'empty' — no nodes exist, every pointer lands on blank space.
 */
function MountDispatcher({
  canvasRef,
  toolBindings,
  dispatcher,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Optional bindings to treat as if they were on the active tool. */
  toolBindings?: import('../gestures/spec').GestureSpec[];
  /** Optional dispatcher to adopt, so a test can read its in-flight state. */
  dispatcher?: Dispatcher;
}) {
  const registry = useActionsRegistry();

  // Build a fake toolsById map with a single tool that has the given bindings.
  const toolsById = useRef<ReadonlyMap<string, { bindings?: unknown[] }>>(
    new Map([
      ['rect', {
        bindings: toolBindings?.map((spec) => ({
          spec,
          actionId: 'insert',
          opts: { params: { kind: 'rect' } },
        })) ?? [],
      }],
    ])
  ).current as ReadonlyMap<string, import('../../tools/types').AnyTool>;

  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById,
    // All clicks land on 'empty' — no bodies to hit.
    classifyTarget: () => ({ body: 'empty' }),
    dispatcher,
    // Active tool is 'rect'.
  });
  return <canvas ref={canvasRef} data-testid="canvas" />;
}

/** Registers live dep source for 'insert'. */
function RegisterInsertDep({ dep }: { dep: InsertDep }) {
  const registry = useDepRegistry();
  registry.register('insert', () => dep);
  return null;
}

/** Registers insertAction with enabled: () => true. */
function RegisterInsert() {
  const registry = useActionsRegistry();
  if (registry && !registry.list().find((a) => a.id === 'insert')) {
    registry.register({ ...insertAction, enabled: () => true as const });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fire helper
// ---------------------------------------------------------------------------

function fire(canvas: HTMLElement, type: string, clientX: number, clientY: number) {
  canvas.dispatchEvent(
    new PointerEvent(type, { bubbles: true, clientX, clientY, pointerId: 1, isPrimary: true }),
  );
}

// ---------------------------------------------------------------------------
// Harness factory
// ---------------------------------------------------------------------------

function buildHarness(dep: InsertDep, dispatcher?: Dispatcher) {
  const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement | null>;

  // The rect tool binding spec: drag-on-empty routes to insertAction.
  const rectDragSpec = { kind: 'drag' as const, target: 'empty' as const };

  function Harness() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = ref.current;

    return (
      <DepRegistryProvider>
        <ActiveToolContextProvider initialActive="rect">
            <ActionsProvider>
              <RegisterInsertDep dep={dep} />
              <RegisterInsert />
              <MountDispatcher
                canvasRef={ref}
                toolBindings={[rectDragSpec]}
                dispatcher={dispatcher}
              />
            </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    );
  }

  return { Harness, canvasRef };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('insertAction integration via gesture dispatcher', () => {
  it('drag-on-empty calls InsertDep.commit with correct bounds and kind', () => {
    const { dep, calls } = makeInsertDep();
    const { Harness } = buildHarness(dep);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    // Drag from (10,10) to (110,60) — final bounds: {x:10,y:10,w:100,h:50}.
    act(() => { fire(canvas, 'pointerdown', 10, 10); });
    act(() => { fire(canvas, 'pointermove', 60, 35); });
    act(() => { fire(canvas, 'pointermove', 110, 60); });
    act(() => { fire(canvas, 'pointerup', 110, 60); });

    expect(calls).toHaveLength(1);
    expect(calls[0].kind).toBe('rect');
    expect(calls[0].bounds).toEqual({ x: 10, y: 10, width: 100, height: 50 });
  });

  it('sub-threshold drag (zero width) does NOT call InsertDep.commit', () => {
    const { dep, calls } = makeInsertDep();
    const { Harness } = buildHarness(dep);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    // Click without movement — width === 0, no insert.
    act(() => { fire(canvas, 'pointerdown', 50, 50); });
    act(() => { fire(canvas, 'pointerup', 50, 50); });

    expect(calls).toHaveLength(0);
  });

  it('reports live gesture bounds mid-drag, before anything is committed', () => {
    // The case `CanvasHelpers.getGestureBounds()` exists for: the shape being
    // drawn has no scene node yet, so no id-keyed lookup can see it.
    const { dep, calls } = makeInsertDep();
    const dispatcher = createDispatcher();
    const { Harness } = buildHarness(dep, dispatcher);
    const source = createGestureSource(() => dispatcher);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    expect(unionGestureBounds(source.bounds() ?? [])).toBeNull();

    act(() => { fire(canvas, 'pointerdown', 10, 10); });
    act(() => { fire(canvas, 'pointermove', 60, 35); });
    expect(unionGestureBounds(source.bounds() ?? []))
      .toEqual({ x: 10, y: 10, width: 50, height: 25 });

    act(() => { fire(canvas, 'pointermove', 110, 60); });
    expect(unionGestureBounds(source.bounds() ?? []))
      .toEqual({ x: 10, y: 10, width: 100, height: 50 });

    // On release the node commits and the gesture is over — bounds go back to
    // null, and the committed geometry is the consumer's own business.
    act(() => { fire(canvas, 'pointerup', 110, 60); });
    expect(calls).toHaveLength(1);
    expect(unionGestureBounds(source.bounds() ?? [])).toBeNull();
  });

  it('bumps the gesture version on each pump of an insert drag', () => {
    const { dep } = makeInsertDep();
    const dispatcher = createDispatcher();
    const { Harness } = buildHarness(dep, dispatcher);
    const source = createGestureSource(() => dispatcher);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    const seen: number[] = [];
    const unsubscribe = source.subscribe(() => { seen.push(source.getVersion()); });

    act(() => { fire(canvas, 'pointerdown', 10, 10); });
    act(() => { fire(canvas, 'pointermove', 60, 35); });
    act(() => { fire(canvas, 'pointerup', 110, 60); });
    unsubscribe();

    // One notify per pump, strictly increasing, covering start → move → end.
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('pointercancel does not insert', () => {
    const { dep, calls } = makeInsertDep();
    const { Harness } = buildHarness(dep);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => { fire(canvas, 'pointerdown', 10, 10); });
    act(() => { fire(canvas, 'pointermove', 60, 35); });
    act(() => { fire(canvas, 'pointercancel', 110, 60); });

    expect(calls).toHaveLength(0);
  });
});
