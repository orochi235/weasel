// src/tools/builtin/integration.test.tsx
//
// Phase 2a end-to-end smoke test.
// Proves: Canvas tools={tools} → dispatcher → tool record → wrapped controller → adapter → ops.
// Also proves: legacy keybinding paths did NOT double-fire (dedupe).

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { ActiveToolContextProvider } from '../../interactions/actions/activeToolContext';
import { useTools, useSelectTool, useKeybindings } from '../';
import { useHandTool } from './useHandTool';
import { Canvas } from 'canvas/Canvas';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import { useSelection } from 'core/selection/useSelection';

// jsdom doesn't implement getContext or pointer capture; stub minimally.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

interface Rect { id: string; x: number; y: number; width: number; height: number }
interface Pose { x: number; y: number; width: number; height: number }

// clientToWorld passthrough (jsdom getBoundingClientRect returns zeros, so
// clientX/Y == worldX/Y in our test setup).
const C2W = (_c: HTMLCanvasElement, cx: number, cy: number): [number, number] => [cx, cy];

// Phase 14e Task 2.6 + Task 3 note: these end-to-end tests rendered bare
// `<Canvas>` (not `<SceneCanvas>`), so the gesture dispatcher is not
// mounted and the legacy hooks that used to drive drag from the
// active-tool route table have been deleted. The dispatcher path for
// select/hand/rotate is exercised by SceneCanvas-rooted integration
// tests + each action descriptor's own tests.
describe.skip('Phase 2a integration (deleted: bare Canvas drag without dispatcher)', () => {
  it('select tool: pointerdown→move→up over a body produces a Transform op', () => {
    // applyOps is the interception point: dispatchApplyBatch in useMove.end()
    // calls adapter.applyOps(ops, label) when the method is present.
    const applyOps = vi.fn();

    function Harness() {
      const [rects, setRects] = useState<Rect[]>([
        { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      ]);
      const rectsRef = useRef(rects);
      rectsRef.current = rects;
      const sel = useSelection({ mode: 'single' });

      const base = arrayAdapter<Rect, Pose>({
        ref: rectsRef,
        setItems: setRects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
      });

      // Intercept at applyOps so we capture exactly the ops the gesture commits.
      const adapter = { ...base, applyOps };

      const pickEvery = (wx: number, wy: number) => {
        for (let i = rectsRef.current.length - 1; i >= 0; i--) {
          const r = rectsRef.current[i];
          if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) {
            return [r.id];
          }
        }
        return [];
      };
      const selectTool = useSelectTool(adapter, {
        pickEvery,
        boundsOf: (id) => {
          const r = rectsRef.current.find((o) => o.id === id);
          return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
        },
      });

      const tools = useTools({
        active: 'select',
        registry: { select: selectTool },
      });

      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter}
          selection={sel}
          tools={tools}
          clientToWorld={C2W}
          pickEvery={pickEvery}
        />
      );
    }

    const { container } = render(<ActiveToolContextProvider initialActive="select"><Harness /></ActiveToolContextProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    // Pointer-down in the center of rect 'a' (50, 50).
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    // Move far enough to cross the dispatcher's drag threshold (default: 4px).
    // onStart fires here; useMove records this position as its start.
    fireEvent.pointerMove(canvas, { clientX: 125, clientY: 125, pointerId: 1 });
    // Move again from (125,125) to cross useMove's internal sub-gesture threshold.
    fireEvent.pointerMove(canvas, { clientX: 130, clientY: 130, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 130, clientY: 130, pointerId: 1 });

    // useMove.end() → dispatchApplyBatch → adapter.applyOps(ops, label).
    // Exactly one call — proves the tools path (not legacy) fired.
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [ops, label] = applyOps.mock.calls[0] as [Array<{ apply: unknown; invert: unknown }>, string];
    expect(ops.length).toBeGreaterThan(0);
    // The move label is 'Move'; the ops are Transform ops (they carry no type
    // field — identified by label on the batch call).
    expect(label).toBe('Move');
    // Each op must be invertible (structural check for a valid Op).
    for (const op of ops) {
      expect(typeof op.invert).toBe('function');
    }
  });

});
// Note: The former 'delete tool' test exercised useDeleteTool (wrapper now
// dissolved in Phase 8). Dispatcher coverage lives in
// src/canvas/SceneCanvas.dispatcher.test.tsx (Phase 8 safety tests).

describe('Phase 2b end-to-end: hand tool + Canvas viewport', () => {
  // Phase 14e Task 2.6: hand tool drag requires the SceneCanvas-mounted
  // gesture dispatcher; bare `<Canvas>` no longer drives pan. The
  // "drag pans" assertion is covered by SceneCanvas integration tests.
  it.skip('H switches active to hand; drag pans; view updates', async () => {
    const onViewChange = vi.fn();

    function Harness() {
      const [view, setView] = useState({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const select = useSelectTool(
        {
          getNode: () => undefined,
          getPose: () => null,
          getNodes: () => [],
          getParent: () => null,
          setParent: () => {},
          setPose: () => {},
          getSelection: () => [],
          setSelection: () => {},
          hitTestArea: () => [],
          applyOps: () => {},
        },
        {
          pickEvery: () => [],
          boundsOf: () => null,
        },
      );
      const hand = useHandTool();
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return (
        <Canvas
          width={200}
          height={200}
          view={view}
          onViewChange={(v) => { setView(v); onViewChange(v); }}
          tools={tools}
          layers={{ scene: { drawOne: () => [] } }}
        />
      );
    }

    const { container } = render(<ActiveToolContextProvider initialActive="select"><Harness /></ActiveToolContextProvider>);
    const canvas = container.querySelector('canvas')!;

    // Switch to hand via the H key. Wrap in act() to flush the React state update.
    act(() => { fireEvent.keyDown(document, { key: 'H' }); });

    // jsdom doesn't support clientX in PointerEvent constructor; use MouseEvent
    // (same event structure, React's onPointer* handlers receive it fine).
    function mkPointerEvent(type: string, clientX: number, clientY: number) {
      const e = new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
      return e;
    }

    // Pointer down + small move to cross threshold (onStart captures startClient at
    // the threshold-crossing event) + larger move (onMove fires and calls setView).
    canvas.dispatchEvent(mkPointerEvent('pointerdown', 100, 100));
    canvas.dispatchEvent(mkPointerEvent('pointermove', 110, 110)); // crosses threshold → onStart; startClient=(110,110)
    canvas.dispatchEvent(mkPointerEvent('pointermove', 160, 140)); // triggers onMove → dx=50, dy=30
    canvas.dispatchEvent(mkPointerEvent('pointerup', 160, 140));

    // dx=50, dy=30 → view = (0-50, 0-30) = (-50, -30)
    expect(onViewChange).toHaveBeenCalledWith({ x: -50, y: -30, scale: { x: 1, y: 1 } });
  });

  it('space engages momentary hand; release returns to prior tool', () => {
    const onViewChange = vi.fn();

    function Harness() {
      const [view, setView] = useState({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const select = useSelectTool(
        {
          getNode: () => undefined,
          getPose: () => null,
          getNodes: () => [],
          getParent: () => null,
          setParent: () => {},
          setPose: () => {},
          getSelection: () => [],
          setSelection: () => {},
          hitTestArea: () => [],
          applyOps: () => {},
        },
        {
          pickEvery: () => [],
          boundsOf: () => null,
        },
      );
      const hand = useHandTool();
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      // Surface tools.hotkeyEngaged for the assertion.
      (window as unknown as { __tools: typeof tools }).__tools = tools;
      return (
        <Canvas
          width={200}
          height={200}
          view={view}
          onViewChange={(v) => { setView(v); onViewChange(v); }}
          tools={tools}
          layers={{ scene: { drawOne: () => [] } }}
        />
      );
    }

    render(
      <ActiveToolContextProvider initialActive="select">
        <Harness />
      </ActiveToolContextProvider>
    );

    act(() => { fireEvent.keyDown(document, { key: ' ' }); });
    // Re-read from window after re-render (state update causes Harness to re-render
    // and update window.__tools with the fresh tools snapshot).
    const afterDown = (window as unknown as { __tools: { hotkeyEngaged: string | null } }).__tools;
    expect(afterDown.hotkeyEngaged).toBe('hand');

    act(() => { fireEvent.keyUp(document, { key: ' ' }); });
    const afterUp = (window as unknown as { __tools: { hotkeyEngaged: string | null } }).__tools;
    expect(afterUp.hotkeyEngaged).toBeNull();
  });
});

// Phase 2c: zoom + pan composition tests removed (Phase 8.5).
// useWheelZoomTool, useWheelPanTool, useKeyboardZoomTool dissolved.
// Equivalent behavior is tested in src/interactions/dispatcher/viewport.integration.test.tsx.

describe.skip('Phase 2a: off-canvas pointer release backstop (deleted: bare Canvas drag without dispatcher)', () => {
  // Repro: start a drag, move pointer off-canvas, release outside the canvas.
  // The pointerup lands on `document`, not the canvas. Without a doc-level
  // backstop, the dispatcher's gesture stays in flight forever — the move
  // overlay leaks, the pose is never committed, and on re-entry the ghost is
  // still drawn.
  it('select tool: pointerup dispatched on document commits the move and ends the gesture', () => {
    const applyOps = vi.fn();

    function Harness() {
      const [rects, setRects] = useState<Rect[]>([
        { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      ]);
      const rectsRef = useRef(rects);
      rectsRef.current = rects;
      const sel = useSelection({ mode: 'single' });

      const base = arrayAdapter<Rect, Pose>({
        ref: rectsRef,
        setItems: setRects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
      });
      const adapter = { ...base, applyOps };

      const pickEvery = (wx: number, wy: number) => {
        for (let i = rectsRef.current.length - 1; i >= 0; i--) {
          const r = rectsRef.current[i];
          if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) {
            return [r.id];
          }
        }
        return [];
      };
      const selectTool = useSelectTool(adapter, {
        pickEvery,
        boundsOf: (id) => {
          const r = rectsRef.current.find((o) => o.id === id);
          return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
        },
      });

      const tools = useTools({
        active: 'select',
        registry: { select: selectTool },
      });

      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter}
          selection={sel}
          tools={tools}
          clientToWorld={C2W}
          pickEvery={pickEvery}
        />
      );
    }

    const { container } = render(<ActiveToolContextProvider initialActive="select"><Harness /></ActiveToolContextProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    // Pointer-down on the rect → gesture starts (pending).
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    // Move past the threshold while still on the canvas → promotes to drag.
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 80, pointerId: 1 });
    // Pointer leaves the canvas — the next move arrives via document
    // (browsers route pointermove during a captured drag to the canvas; absent
    // capture they go to whatever element is under the pointer). Dispatch on
    // document to simulate the off-canvas position.
    act(() => {
      document.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 500, clientY: 500, bubbles: true }),
      );
    });
    // User releases outside the canvas. With no doc-level backstop the
    // dispatcher never sees the pointerup and the gesture leaks.
    act(() => {
      document.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 500, clientY: 500, bubbles: true }),
      );
    });

    // The gesture must have committed: applyOps fires exactly once with a
    // 'Move' label.
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [, label] = applyOps.mock.calls[0] as [Array<unknown>, string];
    expect(label).toBe('Move');
  });
});
