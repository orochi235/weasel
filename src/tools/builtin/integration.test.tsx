// src/tools/builtin/integration.test.tsx
//
// Phase 2a end-to-end smoke test.
// Proves: Canvas tools={tools} → dispatcher → tool record → wrapped controller → adapter → ops.
// Also proves: legacy keybinding paths did NOT double-fire (dedupe).

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useTools, useSelectTool, useDeleteTool, useKeybindings, defineTool } from '../';
import { useHandTool } from './useHandTool';
import { useWheelZoomTool } from './useWheelZoomTool';
import { useWheelPanTool } from './useWheelPanTool';
import { useKeyboardZoomTool } from './useKeyboardZoomTool';
import { Canvas } from '../../canvas/Canvas';
import { arrayAdapter } from '../../core/adapters/arrayAdapter';
import { asNodeId } from '../../core/scene/types';
import { useSelection } from '../../core/selection/useSelection';

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

describe('Phase 2a integration', () => {
  it('select tool: pointerdown→move→up over a body produces a Transform op', () => {
    // applyBatch is the interception point: dispatchApplyBatch in useMove.end()
    // calls adapter.applyBatch(ops, label) when the method is present.
    const applyBatch = vi.fn();

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

      // Intercept at applyBatch so we capture exactly the ops the gesture commits.
      const adapter = { ...base, applyBatch };

      const selectTool = useSelectTool(adapter, {
        pickEvery: (wx, wy) => {
          for (let i = rectsRef.current.length - 1; i >= 0; i--) {
            const r = rectsRef.current[i];
            if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) {
              return [r.id];
            }
          }
          return [];
        },
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
        />
      );
    }

    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    // Pointer-down in the center of rect 'a' (50, 50).
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    // Move far enough to cross the drag threshold (default: 4px).
    fireEvent.pointerMove(canvas, { clientX: 125, clientY: 125, pointerId: 1 });
    // Additional move to trigger onMove (useMove internal threshold also needs crossing).
    fireEvent.pointerMove(canvas, { clientX: 125, clientY: 125, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 125, clientY: 125, pointerId: 1 });

    // useMove.end() → dispatchApplyBatch → adapter.applyBatch(ops, label).
    // Exactly one call — proves the tools path (not legacy) fired.
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [ops, label] = applyBatch.mock.calls[0] as [Array<{ apply: unknown; invert: unknown }>, string];
    expect(ops.length).toBeGreaterThan(0);
    // The move label is 'Move'; the ops are Transform ops (they carry no type
    // field — identified by label on the batch call).
    expect(label).toBe('Move');
    // Each op must be invertible (structural check for a valid Op).
    for (const op of ops) {
      expect(typeof op.invert).toBe('function');
    }
  });

  it('delete tool: Backspace with selection fires a Delete op exactly once (dedupe)', () => {
    const applyBatch = vi.fn();

    function Harness() {
      const [rects, setRects] = useState<Rect[]>([
        { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      ]);
      const rectsRef = useRef(rects);
      rectsRef.current = rects;
      const selRef = useRef<string[]>(['a']);

      const base = arrayAdapter<Rect, Pose>({
        ref: rectsRef,
        setItems: setRects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        selectionRef: selRef,
      });

      // Intercept applyBatch — useDelete.deleteSelection() calls dispatchApplyBatch
      // which calls applyBatch when present.
      const adapter = { ...base, applyBatch };

      const sel = useSelection({ initial: [asNodeId('a')], mode: 'single' });
      selRef.current = [...sel.current];

      const deleteTool = useDeleteTool({
        ...adapter,
        getSelection: () => [...sel.current],
      });

      const selectTool = useSelectTool(adapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      });

      const tools = useTools({
        active: 'select',
        registry: { select: selectTool },
        ambient: [deleteTool],
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
          // No gestures.delete prop — the legacy hook is not wired at all in this test.
          // The dedupe assertion (call count = 1) would catch double-fire if it were.
        />
      );
    }

    render(<Harness />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    // Exactly one applyBatch call — from the tool path only (not doubled by a legacy hook).
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [ops, label] = applyBatch.mock.calls[0] as [Array<{ apply: unknown; invert: unknown }>, string];
    // useDelete produces one DeleteOp per selected id plus one SetSelectionOp.
    expect(ops.length).toBeGreaterThan(0);
    expect(label).toBe('Delete');
    // All ops are invertible (structural check).
    for (const op of ops) {
      expect(typeof op.invert).toBe('function');
    }
  });
});

describe('Phase 2b end-to-end: hand tool + Canvas viewport', () => {
  it('H switches active to hand; drag pans; view updates', async () => {
    const onViewChange = vi.fn();

    function Harness() {
      const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
      const select = useSelectTool(
        {
          getObject: () => undefined,
          getPose: () => null,
          getObjects: () => [],
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
          items={[]}
          setItems={() => {}}
          view={view}
          onViewChange={(v) => { setView(v); onViewChange(v); }}
          tools={tools}
          layers={{ scene: { drawOne: () => [] } }}
        />
      );
    }

    const { container } = render(<Harness />);
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
    expect(onViewChange).toHaveBeenCalledWith({ x: -50, y: -30, scale: 1 });
  });

  it('space engages momentary hand; release returns to prior tool', () => {
    const onViewChange = vi.fn();

    function Harness() {
      const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
      const select = useSelectTool(
        {
          getObject: () => undefined,
          getPose: () => null,
          getObjects: () => [],
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
          items={[]}
          setItems={() => {}}
          view={view}
          onViewChange={(v) => { setView(v); onViewChange(v); }}
          tools={tools}
          layers={{ scene: { drawOne: () => [] } }}
        />
      );
    }

    render(<Harness />);

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

describe('Phase 2c: zoom + pan composition', () => {
  function ZoomHarness({
    onViewChange,
    initialView = { x: 0, y: 0, scale: 1 },
  }: {
    onViewChange: (v: { x: number; y: number; scale: number }) => void;
    initialView?: { x: number; y: number; scale: number };
  }) {
    const [view, setView] = useState(initialView);
    const select = useSelectTool(
      {
        getObject: () => undefined,
        getPose: () => null,
        getObjects: () => [],
        getParent: () => null,
        setParent: () => {},
        setPose: () => {},
        getSelection: () => [],
        setSelection: () => {},
        hitTestArea: () => [],
        applyOps: () => {},
      },
      { pickEvery: () => [], boundsOf: () => null },
    );
    const hand = useHandTool();
    const wheelZoom = useWheelZoomTool();
    const wheelPan = useWheelPanTool();
    const keyZoom = useKeyboardZoomTool();
    const tools = useTools({
      active: 'select',
      registry: { select, hand },
      ambient: [wheelZoom, wheelPan, keyZoom],
    });
    useKeybindings(tools);
    return (
      <Canvas
        width={200}
        height={200}
        items={[]}
        setItems={() => {}}
        view={view}
        onViewChange={(v) => { setView(v); onViewChange(v); }}
        tools={tools}
        layers={{ scene: { drawOne: () => [] } }}
      />
    );
  }

  it('ctrl+wheel zooms about cursor anchor', () => {
    const onViewChange = vi.fn();
    const { container } = render(<ZoomHarness onViewChange={onViewChange} />);
    const canvas = container.querySelector('canvas')!;
    const wheel = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
      clientX: 100,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(wheel);
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const v = onViewChange.mock.calls[0][0];
    // wheelStep default 1.1, deltaY=-100 → factor = 1.1^1 = 1.1
    expect(v.scale).toBeCloseTo(1.1);
    // Anchor invariance: cursor at screen (100,50) maps to same world point
    // before and after. Pre: world = 100/1+0 = 100, 50/1+0 = 50.
    expect(100 / v.scale + v.x).toBeCloseTo(100);
    expect(50 / v.scale + v.y).toBeCloseTo(50);
  });

  it('plain wheel pans by deltaX/scale, deltaY/scale', () => {
    const onViewChange = vi.fn();
    const { container } = render(
      <ZoomHarness onViewChange={onViewChange} initialView={{ x: 0, y: 0, scale: 2 }} />,
    );
    const canvas = container.querySelector('canvas')!;
    const wheel = new WheelEvent('wheel', {
      deltaX: 20,
      deltaY: 10,
      ctrlKey: false,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(wheel);
    expect(onViewChange).toHaveBeenLastCalledWith({ x: 10, y: 5, scale: 2 });
  });

  it('Cmd+0 resets view to identity', () => {
    const onViewChange = vi.fn();
    render(
      <ZoomHarness
        onViewChange={onViewChange}
        initialView={{ x: 50, y: 50, scale: 4 }}
      />,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true }));
    });
    expect(onViewChange).toHaveBeenLastCalledWith({ x: 0, y: 0, scale: 1 });
  });

  it('hand drag still pans after a programmatic zoom', () => {
    const onViewChange = vi.fn();
    const { container } = render(
      <ZoomHarness onViewChange={onViewChange} initialView={{ x: 0, y: 0, scale: 2 }} />,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fireEvent.keyDown(document, { key: 'H' }); });
    function mk(type: string, clientX: number, clientY: number) {
      return new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
    }
    canvas.dispatchEvent(mk('pointerdown', 100, 100));
    canvas.dispatchEvent(mk('pointermove', 110, 110)); // crosses threshold; startClient=(110,110)
    canvas.dispatchEvent(mk('pointermove', 160, 140)); // dx=50, dy=30
    canvas.dispatchEvent(mk('pointerup', 160, 140));
    // useHandTool subtracts dx/dy from startView (screen-px pan, ignores scale).
    expect(onViewChange).toHaveBeenLastCalledWith({ x: -50, y: -30, scale: 2 });
  });
});

describe('Phase 2a: off-canvas pointer release backstop', () => {
  // Repro: start a drag, move pointer off-canvas, release outside the canvas.
  // The pointerup lands on `document`, not the canvas. Without a doc-level
  // backstop, the dispatcher's gesture stays in flight forever — the move
  // overlay leaks, the pose is never committed, and on re-entry the ghost is
  // still drawn.
  it('select tool: pointerup dispatched on document commits the move and ends the gesture', () => {
    const applyBatch = vi.fn();

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
      const adapter = { ...base, applyBatch };

      const selectTool = useSelectTool(adapter, {
        pickEvery: (wx, wy) => {
          for (let i = rectsRef.current.length - 1; i >= 0; i--) {
            const r = rectsRef.current[i];
            if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) {
              return [r.id];
            }
          }
          return [];
        },
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
        />
      );
    }

    const { container } = render(<Harness />);
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

    // The gesture must have committed: applyBatch fires exactly once with a
    // 'Move' label.
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [, label] = applyBatch.mock.calls[0] as [Array<unknown>, string];
    expect(label).toBe('Move');
  });
});

describe('Phase 2a integration', () => {
  it('cross-tool: corner-resize affordance fires while a non-select tool is active', () => {
    const applyBatch = vi.fn();
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
      const adapter = { ...base, ...sel.adapterMethods, applyBatch };
      const select = useSelectTool(adapter, {});
      // The noop tool is the active slot; select is in ambient so its overlay
      // is always walked by the hit-test pipeline regardless of which tool
      // occupies the active slot — its corner-resize affordance should fire.
      const noop = defineTool({ id: 'noop', drag: { onStart: () => 'claim' } });
      const tools = useTools({
        active: 'noop',
        registry: { noop },
        ambient: [select],
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
    const { container } = render(<Harness />);
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
    // useResize → applyBatch with a Transform op labeled 'Resize'. If the
    // affordance pipeline is broken, the click would route to noop's
    // drag.onStart instead, and applyBatch wouldn't fire.
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [, batchLabel] = applyBatch.mock.calls[0] as [unknown, string];
    expect(batchLabel).toBe('Resize');
  });

  it('cross-tool: rotation affordance fires while a non-select tool is active', () => {
    const applyBatch = vi.fn();
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
      const adapter = { ...base, ...sel.adapterMethods, applyBatch };
      const select = useSelectTool(adapter, {});
      const noop = defineTool({ id: 'noop', drag: { onStart: () => 'claim' } });
      // select must be in ambient so its affordance overlay is surfaced
      // while noop is active (per Task 12's findings).
      const tools = useTools({
        active: 'noop',
        registry: { noop },
        ambient: [select],
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
    const { container } = render(<Harness />);
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
    // useRotate → applyBatch with a Transform op labeled 'Rotate'.
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [, label] = applyBatch.mock.calls[0] as [unknown, string];
    expect(label).toBe('Rotate');
  });
});
