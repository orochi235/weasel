// src/tools/builtin/integration.test.tsx
//
// Phase 2a end-to-end smoke test.
// Proves: Canvas tools={tools} → dispatcher → tool record → wrapped controller → adapter → ops.
// Also proves: legacy keybinding paths did NOT double-fire (dedupe).

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { ActiveToolContextProvider } from '../../interactions/actions/activeToolContext';
import { useTools, useSelectTool, useKeybindings, defineTool } from '../';
import { useResizeTool } from './useResizeTool';
import { useRotateTool } from './useRotateTool';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { useScene } from 'core/scene/useScene';
import { useHandTool } from './useHandTool';
import { Canvas } from 'canvas/Canvas';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import { asNodeId } from 'core/scene/types';
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

describe('Phase 2a integration', () => {
  it('cross-tool: corner-resize affordance fires while a non-select tool is active', () => {
    const applyOps = vi.fn();
    function Harness() {
      const [rects, setRects] = useState<Rect[]>([
        { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      ]);
      const rectsRef = useRef(rects);
      rectsRef.current = rects;
      // Seed selection on 'a' so the affordance has a render target.
      const sel = useSelection({ initial: [asNodeId('a')], mode: 'single' });
      const base = arrayAdapter<Rect, Pose>({
        ref: rectsRef, setItems: setRects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
      });
      const adapter = { ...base, ...sel.adapterMethods, applyOps };
      const select = useSelectTool(adapter, {});
      const resize = useResizeTool(adapter, {});
      // The noop tool is the active slot; select+resize are in ambient so
      // their overlays are walked by the hit-test pipeline regardless of which
      // tool occupies the active slot — useResizeTool's corner-resize
      // affordance should fire.
      const noop = defineTool({ id: 'noop', drag: { onStart: () => 'claim' } });
      const tools = useTools({
        active: 'noop',
        registry: { noop },
        ambient: [select, resize],
      });
      return (
        <Canvas
          width={200} height={200} layers={{}}
          adapter={adapter} selection={sel} tools={tools} clientToWorld={C2W}
          // Pass boundsOf at the Canvas level so ChromeState.boundsOf resolves
          // correctly for the affordance's hit-test.
          boundsOf={(id) => {
            const r = rectsRef.current.find((x) => x.id === id);
            return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
          }}
        />
      );
    }
    const { container } = render(<ActiveToolContextProvider initialActive="select"><Harness /></ActiveToolContextProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Bounds (0,0,100,100). Bottom-right corner is (100, 100).
    // Use MouseEvent (same structure as PointerEvent for clientX) so that
    // e.clientX is populated on the native event — fireEvent.pointerDown does
    // not propagate clientX to the nativeEvent in jsdom.
    function mkPtr(type: string, clientX: number, clientY: number) {
      return new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
    }
    // Click → tiny move → release.
    canvas.dispatchEvent(mkPtr('pointerdown', 100, 100));
    canvas.dispatchEvent(mkPtr('pointermove', 110, 110));
    canvas.dispatchEvent(mkPtr('pointerup', 110, 110));
    // useResize → applyOps with a Transform op labeled 'Resize'. If the
    // affordance pipeline is broken, the click would route to noop's
    // drag.onStart instead, and applyOps wouldn't fire.
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [, batchLabel] = applyOps.mock.calls[0] as [unknown, string];
    expect(batchLabel).toBe('Resize');
  });

  // Phase 14e Task 3: useRotateTool no longer wires useRotate into the
  // affordance binding. Rotation flows through `rotateAction` via the
  // dispatcher, which is not mounted under bare `<Canvas>`. The
  // cross-tool rotation handoff is covered by rotateAction's own tests
  // and by SceneCanvas integration tests.
  it.skip('cross-tool: rotation affordance fires while a non-select tool is active', () => {
    const applyOps = vi.fn();
    function Harness() {
      const [rects, setRects] = useState<Rect[]>([
        { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      ]);
      const rectsRef = useRef(rects);
      rectsRef.current = rects;
      const sel = useSelection({ initial: [asNodeId('a')], mode: 'single' });
      const base = arrayAdapter<Rect, Pose>({
        ref: rectsRef, setItems: setRects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
      });
      const adapter = { ...base, ...sel.adapterMethods, applyOps };
      const select = useSelectTool(adapter, {});
      const rotate = useRotateTool(adapter, {});
      const noop = defineTool({ id: 'noop', drag: { onStart: () => 'claim' } });
      // select+rotate must be in ambient so the rotation affordance overlay
      // (owned by useRotateTool) is surfaced while noop is active.
      const tools = useTools({
        active: 'noop',
        registry: { noop },
        ambient: [select, rotate],
      });
      return (
        <Canvas
          width={200} height={200} layers={{}}
          adapter={adapter} selection={sel} tools={tools} clientToWorld={C2W}
          boundsOf={(id) => {
            const r = rectsRef.current.find((x) => x.id === id);
            return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
          }}
        />
      );
    }
    const { container } = render(<ActiveToolContextProvider initialActive="select"><Harness /></ActiveToolContextProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Bounds (0,0,100,100). Top-center (50, 0). Default rotation handle
    // distance is 24 world-px above → handle center at (50, -24).
    // Use dispatchEvent (not fireEvent) so clientX/Y reaches the native event.
    canvas.dispatchEvent(new MouseEvent('pointerdown', {
      clientX: 50, clientY: -24, bubbles: true, cancelable: true,
    }));
    canvas.dispatchEvent(new MouseEvent('pointermove', {
      clientX: 60, clientY: -20, bubbles: true, cancelable: true,
    }));
    canvas.dispatchEvent(new MouseEvent('pointerup', {
      clientX: 60, clientY: -20, bubbles: true, cancelable: true,
    }));
    // useRotate → applyOps with a Transform op labeled 'Rotate'.
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [, label] = applyOps.mock.calls[0] as [unknown, string];
    expect(label).toBe('Rotate');
  });

  it('multi-mode corner-resize ends cleanly on pointerup (one applyOps with Resize)', () => {
    const applyOps = vi.fn();
    function Harness() {
      const [rects, setRects] = useState<Rect[]>([
        { id: 'a', x: 0, y: 0, width: 50, height: 50 },
        { id: 'b', x: 60, y: 60, width: 40, height: 40 },
      ]);
      const rectsRef = useRef(rects);
      rectsRef.current = rects;
      // Seed selection on both so multi-mode chrome activates.
      const sel = useSelection({ initial: [asNodeId('a'), asNodeId('b')], mode: 'multi' });
      const base = arrayAdapter<Rect, Pose>({
        ref: rectsRef, setItems: setRects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
      });
      const adapter = { ...base, ...sel.adapterMethods, applyOps };
      const select = useSelectTool(adapter, {});
      const resize = useResizeTool(adapter, {
        getSelection: () => [...sel.current],
      });
      const tools = useTools({ active: 'select', registry: { select }, ambient: [resize] });
      return (
        <Canvas
          width={200} height={200} layers={{}}
          adapter={adapter} selection={sel} selectionMode="multi" tools={tools} clientToWorld={C2W}
          boundsOf={(id) => {
            const r = rectsRef.current.find((x) => x.id === id);
            return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
          }}
        />
      );
    }
    const { container } = render(<ActiveToolContextProvider initialActive="select"><Harness /></ActiveToolContextProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Union AABB is (0,0,100,100). SE corner at (100, 100).
    canvas.dispatchEvent(new MouseEvent('pointerdown', {
      clientX: 100, clientY: 100, bubbles: true, cancelable: true,
    }));
    canvas.dispatchEvent(new MouseEvent('pointermove', {
      clientX: 120, clientY: 120, bubbles: true, cancelable: true,
    }));
    canvas.dispatchEvent(new MouseEvent('pointerup', {
      clientX: 120, clientY: 120, bubbles: true, cancelable: true,
    }));
    // The gesture must commit exactly one labeled 'Resize' call on pointerup.
    // (Transient moves may also fire applyOps without a label, so we filter for
    // the labeled commit rather than asserting total call count.)
    const labeledCalls = applyOps.mock.calls.filter(
      (args) => args[1] !== undefined,
    ) as [unknown, string][];
    expect(labeledCalls).toHaveLength(1);
    expect(labeledCalls[0][1]).toBe('Resize');
  });

  it('multi-mode corner-resize via sceneToAdapter (real applyOps, not stubbed)', () => {
    // Regression: sceneToAdapter.applyOps uses `this.setPose` inside its
    // scene.batch callback. The multi-resize handler previously destructured
    // `applyOps` off the adapter and called it as a detached function,
    // losing `this` and throwing "Cannot read properties of undefined
    // (reading 'setPose')" inside onEnd. That left the dispatcher's inFlight
    // stuck — the gesture "couldn't be dropped." This test exercises the
    // real applyOps (no vi.fn() override) to lock that in.
    let sceneRef: ReturnType<typeof useScene<Rect>> | null = null;
    function Harness() {
      const scene = useScene<Rect>({ items: [
        { id: 'a', x: 0, y: 0, width: 50, height: 50 },
        { id: 'b', x: 60, y: 60, width: 40, height: 40 },
      ]});
      sceneRef = scene;
      const sel = useSelection({ initial: [asNodeId('a'), asNodeId('b')], mode: 'multi' });
      const adapter = sceneToAdapter(scene, { selection: sel });
      const tool = useSelectTool(adapter as never, {});
      const resize = useResizeTool(adapter as never, {
        getSelection: () => [...sel.current],
      });
      const tools = useTools({ active: 'select', registry: { select: tool }, ambient: [resize] });
      return (
        <Canvas width={200} height={200} layers={{}}
          adapter={adapter as never} selection={sel} selectionMode="multi" tools={tools} clientToWorld={C2W}
          boundsOf={(id) => {
            const n = scene.get(asNodeId(id));
            if (!n) return null;
            const p = n.pose as Pose;
            return { x: p.x, y: p.y, width: p.width, height: p.height };
          }}
        />
      );
    }
    const { container } = render(<ActiveToolContextProvider initialActive="select"><Harness /></ActiveToolContextProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Union AABB (0,0,100,100). SE corner at (100,100). Drag to (120,120).
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 120, bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 120, clientY: 120, bubbles: true, cancelable: true }));
    // The leaves must have resized proportionally — proves onEnd's applyOps
    // didn't throw, and the gesture committed.
    const a = sceneRef!.get(asNodeId('a'))!.pose as Pose;
    const b = sceneRef!.get(asNodeId('b'))!.pose as Pose;
    expect(a.width).toBeGreaterThan(50);
    expect(b.width).toBeGreaterThan(40);
  });
});
