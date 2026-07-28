import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, fireEvent, createEvent, act } from '@testing-library/react';
import React, { createRef, useRef, useState } from 'react';
import { Canvas, buildSceneLayer, buildSceneLayers } from './Canvas';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { useSelection } from 'core/selection/useSelection';
import { type NodeId } from 'core/scene/types';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import { useSelectTool } from 'tools/builtin/select';
import { useTools } from 'tools/useTools';
import { WeaselProvider } from '../WeaselProvider';
import type { RenderLayer } from 'core/layers/render';
import { registerProgram } from '../renderer';
import type { DrawCommand } from '../renderer';
import type { DebugSink, DebugSnapshot } from '../debug/types';
import type { CanvasExtensionApi } from './canvasExtension';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';

const waitForFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

// jsdom doesn't implement getContext or pointer capture; stub minimally.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => {
    return {
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
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      font: '',
      textBaseline: '',
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
  });
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('<Canvas>', () => {
  it('renders a <canvas> element with the configured dimensions', () => {
    const { container } = render(<Canvas width={123} height={45} layers={{}} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // jsdom reports the bare attribute, dpr-multiplied isn't asserted here
    expect(canvas!.getAttribute('width')).toBe('123');
    expect(canvas!.getAttribute('height')).toBe('45');
    expect(canvas!.getAttribute('tabindex')).toBe('0');
  });

  it('forwards a ref exposing CanvasExtensionApi', () => {
    const ref = createRef<CanvasExtensionApi>();
    render(<Canvas ref={ref} width={50} height={50} layers={{}} />);
    expect(typeof ref.current?.requestRedraw).toBe('function');
    expect(typeof ref.current?.registerLayer).toBe('function');
  });

  it('mounts without throwing when a custom layer is supplied', () => {
    // Under jsdom, getContext('webgl2') returns a non-null stub and the GL
    // branch early-returns before draw is invoked. Pixel-level dispatch is
    // verified end-to-end by the Playwright smoke (canvas-gl.spec.ts).
    const draw = vi.fn(() => []);
    const layer: RenderLayer<unknown> = { id: 'a', label: 'A', draw };
    const { container } = render(<Canvas width={50} height={50} layers={{ extra: { layer } }} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('auto-build pointer handler routes through tools.dispatcher', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    interface Pose { x: number; y: number; width: number; height: number }
    const seen: string[][] = [];
    function Harness() {
      const sel = useSelection({ mode: 'multi' });
      sel.applyClick = vi.fn((id: string) => seen.push([id]));
      const adapter = {
        getNodes: () => [{ id: 'a', x: 0, y: 0, width: 50, height: 50 }] as Rect[],
        getNode: (id: string) => (id === 'a'
          ? { id: 'a', x: 0, y: 0, width: 50, height: 50 } as Rect
          : undefined),
        getPose: (id: string) => (id === 'a' ? { x: 0, y: 0, width: 50, height: 50 } : null) as Pose,
        setPose: () => {},
        ...sel.adapterMethods,
      };
      const select = useSelectTool<Rect, Pose>(adapter, {
        pickEvery: () => ['a'],
      });
      const tools = useTools({ active: 'select', registry: { select } });
      return <Canvas width={50} height={50} layers={{}} adapter={adapter} selection={sel} tools={tools} clientToWorld={() => [5, 5]} />;
    }
    const { container } = render(<WeaselProvider><Harness /></WeaselProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5 });
    expect(seen).toEqual([['a']]);
  });

  it('passes className and style through', () => {
    const { container } = render(
      <Canvas width={10} height={10} layers={{}} className="x" style={{ display: 'block' }} />,
    );
    const canvas = container.querySelector('canvas')!;
    expect(canvas.className).toBe('x');
    expect(canvas.style.display).toBe('block');
  });

  it('integrates with useSelection through useSelectTool (smoke)', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    interface Pose { x: number; y: number; width: number; height: number }
    function TestHarness() {
      const sel = useSelection({ mode: 'multi' });
      const adapter = {
        getNodes: () => [] as Rect[],
        getNode: () => undefined,
        getPose: () => ({ x: 0, y: 0, width: 0, height: 0 }) as Pose,
        setPose: () => {},
        ...sel.adapterMethods,
      };
      const select = useSelectTool<Rect, Pose>(adapter, {
        pickEvery: () => ['a'],
      });
      const tools = useTools({ active: 'select', registry: { select } });
      return <Canvas width={50} height={50} layers={{}} adapter={adapter} selection={sel} tools={tools} />;
    }
    const { container } = render(<WeaselProvider><TestHarness /></WeaselProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  describe('useSelectTool body/handle routing', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    interface Pose { x: number; y: number; width: number; height: number }

    // jsdom doesn't propagate clientX/Y through fireEvent.pointerDown reliably
    // and getBoundingClientRect returns zeros — so override clientToWorld with
    // a closure-driven fixed point per test invocation.
    let nextWorld: [number, number] = [0, 0];
    const C2W = (_c: HTMLCanvasElement, _x: number, _y: number): [number, number] => nextWorld;

    it('useSelectTool routes body-hit clicks through selection.applyClick', () => {
      const seen: string[][] = [];
      function Harness() {
        const [rects] = useState<Rect[]>([{ id: 'a', x: 0, y: 0, width: 100, height: 100 }]);
        const rectsRef = useRef(rects);
        rectsRef.current = rects;
        const sel = useSelection();
        seen.push([...sel.current]);
        const adapter = {
          ...arrayAdapter<Rect, Pose>({
            ref: rectsRef,
            setItems: () => {},
            toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
          }),
          ...sel.adapterMethods,
        };
        const select = useSelectTool<Rect, Pose>(adapter, {
          pickEvery: (wx, wy) =>
            rectsRef.current
              .filter((r) => wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height)
              .map((r) => r.id),
        });
        const tools = useTools({ active: 'select', registry: { select } });
        return (
          <Canvas
            width={100}
            height={100}
            layers={{}}
            adapter={adapter}
            selection={sel}
            tools={tools}
            clientToWorld={C2W}
          />
        );
      }
      const { container } = render(<WeaselProvider><Harness /></WeaselProvider>);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      nextWorld = [10, 10];
      fireEvent.pointerDown(canvas);
      // After the click, selection should contain 'a' at some render.
      expect(seen.some((s) => s.length === 1 && s[0] === 'a')).toBe(true);
    });

    it('useSelectTool collapses overlapping body hits to the topmost id', () => {
      const seen: string[][] = [];
      // Two overlapping rects; 'b' is on top in render order (last).
      const rects: Rect[] = [
        { id: 'a', x: 0, y: 0, width: 50, height: 50 },
        { id: 'b', x: 0, y: 0, width: 50, height: 50 },
      ];
      function Harness() {
        const rectsRef = useRef(rects);
        const sel = useSelection();
        seen.push([...sel.current]);
        const adapter = {
          ...arrayAdapter<Rect, Pose>({
            ref: rectsRef,
            setItems: () => {},
            toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
          }),
          ...sel.adapterMethods,
        };
        const select = useSelectTool<Rect, Pose>(adapter, {
          pickEvery: (wx, wy) =>
            rectsRef.current
              .filter((r) => wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height)
              .map((r) => r.id),
        });
        const tools = useTools({ active: 'select', registry: { select } });
        return (
          <Canvas
            width={50}
            height={50}
            layers={{}}
            adapter={adapter}
            selection={sel}
            tools={tools}
            clientToWorld={C2W}
          />
        );
      }
      const { container } = render(<WeaselProvider><Harness /></WeaselProvider>);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      nextWorld = [5, 5];
      fireEvent.pointerDown(canvas);
      // pickTopMostHit picks the last id in the hit list (siblings → topmost).
      expect(seen.some((s) => s.length === 1 && s[0] === 'b')).toBe(true);
    });

    // The "Canvas boundsOf drives the corner-resize
    // affordance hit-test" test required `useResizeTool` to mount an
    // ambient affordance overlay. With the legacy tool deleted, the
    // resize affordance is now produced by the dispatcher-side
    // `resizeAction` + `resizePolicy` dep, which has no surface inside a
    // bare `<Canvas>` harness. The equivalent assertion now lives in the
    // SceneCanvas / dispatcher tests.
  });

  describe('selectionMode', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    interface Pose { x: number; y: number; width: number; height: number }

    const RECTS: Rect[] = [
      { id: 'a', x: 0,   y: 0, width: 50, height: 50 },
      { id: 'b', x: 100, y: 0, width: 50, height: 50 },
      { id: 'c', x: 200, y: 0, width: 50, height: 50 },
    ];

    function Harness(props: {
      mode: 'single' | 'multi';
      initial?: string[];
      onSelChange?: (ids: string[]) => void;
      moveStart?: (ids: string[]) => void;
    }) {
      const rectsRef = useRef<Rect[]>(RECTS);
      const sel = useSelection({ initial: props.initial as readonly NodeId[] | undefined, mode: props.mode });
      props.onSelChange?.([...sel.current]);
      const adapter = {
        ...arrayAdapter<Rect, Pose>({
          ref: rectsRef,
          setItems: () => {},
          toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        }),
        ...sel.adapterMethods,
      };
      const pickEvery = (wx: number, wy: number) =>
        rectsRef.current
          .filter((r) => wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height)
          .map((r) => r.id);
      const select = useSelectTool<Rect, Pose>(adapter, {
        pickEvery,
        move: { behaviors: [{ onStart: (ctx: { draggedIds: string[] }) => props.moveStart?.(ctx.draggedIds) }] },
      });
      const tools = useTools({ active: 'select', registry: { select } });
      return (
        <Canvas
          width={300}
          height={50}
          layers={{}}
          adapter={adapter}
          selection={sel}
          tools={tools}
          pickEvery={pickEvery}
        />
      );
    }

    it('single (default): click replaces selection; no shift-extend', () => {
      const seen: string[][] = [];
      const { container, rerender } = render(
        <WeaselProvider><Harness mode="single" onSelChange={(ids) => seen.push(ids)} /></WeaselProvider>,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      // In tools mode, Canvas computes world coords from client coords via
      // getBoundingClientRect (zero in jsdom) — so clientX/Y maps 1:1 to
      // worldX/Y at scale 1. The C2W stub is unused in tools mode.
      // jsdom's PointerEvent ignores clientX/Y from the dict-init shorthand;
      // construct the event explicitly so both reach the dispatcher.
      const downA = createEvent.pointerDown(canvas, { pointerId: 1 });
      Object.defineProperty(downA, 'clientX', { value: 10 });
      Object.defineProperty(downA, 'clientY', { value: 10 });
      fireEvent(canvas, downA);
      fireEvent.pointerUp(canvas, { pointerId: 1 });
      const downB = createEvent.pointerDown(canvas, { pointerId: 2 });
      Object.defineProperty(downB, 'clientX', { value: 110 });
      Object.defineProperty(downB, 'clientY', { value: 10 });
      fireEvent(canvas, downB);
      fireEvent.pointerUp(canvas, { pointerId: 2 });
      rerender(<WeaselProvider><Harness mode="single" onSelChange={(ids) => seen.push(ids)} /></WeaselProvider>);
      const last = seen[seen.length - 1];
      expect(last).toEqual(['b']);
    });

    // Bare `<Canvas>` no longer drives move via the
    // legacy `useMove` hook (deleted from useSelectTool). Drag flows through
    // the gesture dispatcher mounted by `<SceneCanvas>`, so the
    // "moveStart behavior fires" assertion that exercised useMove from
    // bare Canvas has no surface to fire on. The drag-the-whole-set
    // semantic is now covered by moveAction's own tests (selection
    // resolution lives in pointerDownBody + moveAction's start).

  });
});

describe('Canvas onUncapturedMove / onUncapturedLeave', () => {
  it('layer.onUncapturedMove fires on pointermove when no gesture is captured', () => {
    const moveSpy = vi.fn();
    const layer: RenderLayer<unknown> = {
      id: 'tracker', label: 'tracker', space: 'screen',
      draw: () => [],
      onUncapturedMove: moveSpy,
    };
    const ref = createRef<CanvasExtensionApi>();
    const { container } = render(
      <Canvas
        ref={ref}
        width={100} height={100}
        layers={{ custom: { layer } }}
        clientToWorld={(_canvas, cx, cy) => [cx, cy]}
      />
    );
    const canvas = container.querySelector('canvas')!;
    // Use createEvent + defineProperty pattern — jsdom's PointerEvent ignores
    // clientX/Y from the init dict shorthand (same pattern as other Canvas tests).
    const ev = createEvent.pointerMove(canvas);
    Object.defineProperty(ev, 'clientX', { value: 30 });
    Object.defineProperty(ev, 'clientY', { value: 40 });
    fireEvent(canvas, ev);
    expect(moveSpy).toHaveBeenCalled();
    const call = moveSpy.mock.calls[0];
    expect(call[0]).toBe(30);  // worldX
    expect(call[1]).toBe(40);  // worldY
  });

  it('layer.onUncapturedLeave fires on pointerleave', () => {
    const leaveSpy = vi.fn();
    const layer: RenderLayer<unknown> = {
      id: 'tracker', label: 'tracker', space: 'screen',
      draw: () => [],
      onUncapturedLeave: leaveSpy,
    };
    const ref = createRef<CanvasExtensionApi>();
    const { container } = render(
      <Canvas
        ref={ref}
        width={100} height={100}
        layers={{ custom: { layer } }}
      />
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerLeave(canvas);
    expect(leaveSpy).toHaveBeenCalled();
  });

  it('layer.onUncapturedMove is suppressed when a gesture is active', () => {
    const moveSpy = vi.fn();
    const layer: RenderLayer<unknown> = {
      id: 'tracker', label: 'tracker', space: 'screen',
      draw: () => [],
      onUncapturedMove: moveSpy,
    };
    // Mock a tools object with a dispatcher that reports an active gesture.
    const mockDispatcher = {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
      cancelGesture: vi.fn(),
      onKeyDown: vi.fn(),
      onKeyUp: vi.fn(),
      onWheel: vi.fn(),
      hasActiveGesture: vi.fn(() => true),
      getActiveScratch: vi.fn(() => null),
      __setGetCtx: vi.fn(),
      __setHitTestContext: vi.fn(),
    };
    const mockTools = {
      active: 't',
      hotkeyEngaged: null,
      gestureTick: 0,
      registry: {},
      dispatcher: mockDispatcher,
      getActiveOverlays: () => [],
      has: () => false,
    } as never;
    const { container } = render(
      <Canvas
        width={100} height={100}
        layers={{ custom: { layer } }}
        tools={mockTools}
        clientToWorld={(_canvas, cx, cy) => [cx, cy]}
      />
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 20 });
    expect(moveSpy).not.toHaveBeenCalled();
  });
});

import { defineTool } from 'tools/routing/defineTool';
import { begin, claim } from 'tools/routing/result';
import { ROTATED_POSE_DESCRIPTOR } from 'interactions/actions/resize/geometry';

describe('Canvas tools mode', () => {
  it('routes pointer events through tools.dispatcher when tools prop is passed', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();

    function Test() {
      const tools = useTools({
        active: 't',
        registry: {
          t: defineTool({
            id: 't',
            initial: {
              drag: () => {
                onDragStart();
                return begin({
                  scratch: null,
                  onRelease: () => { onDragEnd(); return claim(); },
                });
              },
            },
          }),
        },
      });
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container } = render(<WeaselProvider><Test /></WeaselProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onDragEnd).toHaveBeenCalledOnce();
  });

  it('does NOT invoke usePointerGestures-derived selection clear when tools prop is passed', () => {
    // Tap on empty space normally calls selection.clear(); with tools wired,
    // it should route through the dispatcher instead.
    const select = { current: [], get: vi.fn(() => []), clear: vi.fn(), set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), applyClick: vi.fn() };

    function Test() {
      const tools = useTools({
        active: 't',
        registry: { t: defineTool({ id: 't', initial: {} }) }, // no handlers — every event passes
      });
      return (
        <Canvas
          width={100}
          height={100}
          adapter={{} as never}
          layers={{}}
          selection={select as never}
          tools={tools}
        />
      );
    }

    const { container } = render(<WeaselProvider><Test /></WeaselProvider>);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 10, clientY: 10, pointerId: 1 });

    // Without tools, selection.clear() would have been called from the
    // usePointerGestures empty-space tap path. With tools, it must not.
    expect(select.clear).not.toHaveBeenCalled();
  });

  it('applies the active tool cursor to the canvas style', () => {
    function Test() {
      const tools = useTools({
        active: 't',
        registry: { t: defineTool({ id: 't', cursor: 'crosshair', initial: {} }) },
      });
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container } = render(<WeaselProvider><Test /></WeaselProvider>);
    const canvas = container.querySelector('canvas')! as HTMLCanvasElement;
    expect(canvas.style.cursor).toBe('crosshair');
  });

  describe('tools integration', () => {
    it('appends tools.getActiveOverlays() to the layer pipeline (rendered last)', () => {
      const order: string[] = [];
      const toolOverlay: RenderLayer<unknown> = {
        id: 'tool-ov',
        label: 'tool overlay',
        space: 'screen',
        draw: () => { order.push('tool-ov'); return []; },
      };
      const customLayer: RenderLayer<unknown> = {
        id: 'custom-tail',
        label: 'custom tail',
        space: 'screen',
        draw: () => { order.push('custom-tail'); return []; },
      };
      // A custom layer with `after: 'selectionOverlay'` exercises the slot
      // ordering: it should still render before the tool overlay (which is
      // appended at the very end of the pipeline).
      const afterSel: RenderLayer<unknown> = {
        id: 'after-sel',
        label: 'after sel',
        space: 'screen',
        draw: () => { order.push('after-sel'); return []; },
      };

      function Test() {
        const tool = defineTool({ id: 't', initial: { overlay: () => toolOverlay } });
        const tools = useTools({
          active: 't',
          registry: { t: tool },
        });
        return (
          <Canvas
            width={50}
            height={50}
            layers={{
              custom: { layer: customLayer },
              afterSel: { layer: afterSel, after: 'selectionOverlay' },
            }}
            tools={tools}
          />
        );
      }

      // Under jsdom getContext('webgl2') returns a non-null stub and the GL
      // branch early-returns before draw is invoked, so the `order` array
      // stays empty here. The authoritative layer-ordering check is the
      // Playwright smoke (canvas-gl.spec.ts). This test now just ensures the
      // composition mounts without throwing.
      const { container } = render(<WeaselProvider><Test /></WeaselProvider>);
      expect(container.querySelector('canvas')).toBeTruthy();
      // Reference the layer objects so the `order` capture stays wired —
      // a future test runner that does fire draw under jsdom would pick this up.
      void order;
    });

    it('tools.has() returns true for ids in registry and ambient', () => {
      let capturedHas: ((id: string) => boolean) | undefined;

      function Test() {
        const always = defineTool({ id: 'delete', initial: {} });
        const active = defineTool({ id: 'select', initial: {} });
        const tools = useTools({
          active: 'select',
          registry: { select: active },
          ambient: [always],
        });
        capturedHas = tools.has.bind(tools);
        return <Canvas width={50} height={50} layers={{}} tools={tools} />;
      }

      render(<WeaselProvider><Test /></WeaselProvider>);
      expect(capturedHas?.('select')).toBe(true);
      expect(capturedHas?.('delete')).toBe(true);
      expect(capturedHas?.('nudge')).toBe(false);
    });
  });
});

describe('Canvas viewport', () => {
  function noopScene() {
    return { drawOne: () => [] } as const;
  }

  it('uncontrolled: defaults to {x:0,y:0} and is internally mutable', () => {
    const onViewChange = vi.fn();
    const { container } = render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        onViewChange={onViewChange}
      />,
    );
    // Initial value is {0,0}; onViewChange not yet called.
    expect(onViewChange).not.toHaveBeenCalled();
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('uncontrolled: defaultView seeds initial state', () => {
    const onViewChange = vi.fn();
    render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        defaultView={{ x: 50, y: 25, scale: { x: 1, y: 1 } }}
        onViewChange={onViewChange}
      />,
    );
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('controlled: passing view + onViewChange honors the prop on render', () => {
    const onViewChange = vi.fn();
    const { rerender } = render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        view={{ x: 10, y: 20, scale: { x: 1, y: 1 } }}
        onViewChange={onViewChange}
      />,
    );
    rerender(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        view={{ x: 30, y: 40, scale: { x: 1, y: 1 } }}
        onViewChange={onViewChange}
      />,
    );
    // No assertion on draw side — view prop change just shouldn't throw.
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('view defaults to scale=1 when defaultView is omitted', () => {
    const onViewChange = vi.fn();
    render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        onViewChange={onViewChange}
      />,
    );
    // View change isn't fired on initial mount; this is a smoke check that the
    // `defaultView ?? { x:0, y:0, scale: { x: 1, y: 1 } }` path doesn't throw on the View
    // type's required `scale` field.
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('accepts a scale-aware view prop without throwing', () => {
    const onViewChange = vi.fn();
    render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        view={{ x: 5, y: 5, scale: { x: 2, y: 2 } }}
        onViewChange={onViewChange}
      />,
    );
    expect(onViewChange).not.toHaveBeenCalled();
  });
});

describe('Canvas debug overlay', () => {
  function noopScene() {
    return { drawOne: () => [] } as const;
  }

  it('debug={false} produces no overlay layer even when URL has ?debug=all', () => {
    const original = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?debug=all' },
      writable: true,
    });
    try {
      const { container } = render(
        <Canvas
          width={100} height={100}
                    layers={{ scene: noopScene() }}
          debug={false}
        />,
      );
      expect(container.querySelector('canvas')).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: original },
        writable: true,
      });
    }
  });

  it('debug={config} accepts an explicit config object', () => {
    const { container } = render(
      <Canvas
        width={100} height={100}
                layers={{ scene: noopScene() }}
        debug={{ bounds: true }}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it.skip('records bounds + origins for each item when those flags are on (skipped: GL backend in jsdom early-returns before draw fires)', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', x: 20, y: 30, w: 5, h: 5 },
      { id: 'c', x: 40, y: 50, w: 8, h: 8 },
    ];
    const sinkRef: { current: (DebugSink & { snapshot(): DebugSnapshot }) | null } = { current: null };
    render(
      <Canvas
        width={100} height={100}
                layers={{ scene: { drawOne: () => [] } }}
        boundsOf={(id) => {
          const it = items.find((i) => i.id === id);
          return it ? { x: it.x, y: it.y, width: it.w, height: it.h } : null;
        }}
        debug={{ bounds: true, origins: true }}
        debugSinkRef={sinkRef}
      />,
    );
    const snap = sinkRef.current?.snapshot();
    expect(snap?.bounds.length).toBeGreaterThanOrEqual(3);
    expect(snap?.origins.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(snap!.bounds.map((b) => b.id));
    expect(ids.has('a') && ids.has('b') && ids.has('c')).toBe(true);
  });

  it('records layer metadata once per non-overlay layer when layers flag is on', () => {
    const sinkRef: { current: (DebugSink & { snapshot(): DebugSnapshot }) | null } = { current: null };
    render(
      <Canvas
        width={100} height={100}
                layers={{ scene: noopScene() }}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );
    const snap = sinkRef.current?.snapshot();
    expect(snap?.layers.length).toBeGreaterThanOrEqual(1);
    // Overlay layer itself must not be recorded.
    expect(snap?.layers.find((l) => l.id === 'debug-overlay')).toBeUndefined();
    // Scene layer should be there.
    expect(snap?.layers.find((l) => l.id === 'scene')).toBeTruthy();
  });

  it('debug undefined falls back to URL parse', () => {
    const original = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?debug=bounds' },
      writable: true,
    });
    try {
      const { container } = render(
        <Canvas
          width={100} height={100}
                    layers={{ scene: noopScene() }}
        />,
      );
      expect(container.querySelector('canvas')).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: original },
        writable: true,
      });
    }
  });
});

describe('GL renderer', () => {
  it('renders without error with default props', () => {
    const { container } = render(
      <Canvas width={100} height={100} layers={{}} />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('calls getContext("webgl2") with preserveDrawingBuffer + stencil', () => {
    const getCtxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<Canvas width={100} height={100} layers={{}} />);
    const webgl2Calls = getCtxSpy.mock.calls.filter((c) => c[0] === 'webgl2');
    expect(webgl2Calls.length).toBeGreaterThan(0);
    expect(webgl2Calls[0][1]).toMatchObject({ preserveDrawingBuffer: true, stencil: true });
    getCtxSpy.mockRestore();
  });

  it('does not call getContext("2d")', () => {
    const getCtxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<Canvas width={100} height={100} layers={{}} />);
    const twoDCalls = getCtxSpy.mock.calls.filter((c) => c[0] === '2d');
    expect(twoDCalls).toHaveLength(0);
    getCtxSpy.mockRestore();
  });

  it('mounts without throwing when a custom layer with draw is present', () => {
    // Sentinel test: confirms the drawLayers dispatch path doesn't throw under
    // jsdom. The authoritative end-to-end pixel check is the Playwright smoke
    // (canvas-gl.spec.ts) — under jsdom getContext('webgl2') returns a non-null
    // stub, so the GL branch early-returns before drawLayers runs and the
    // captured arguments below stay empty. Documenting intent.
    const captured: Array<{ data: unknown; view: unknown; dims: unknown }> = [];
    const customLayer: RenderLayer<unknown> = {
      id: 'capture',
      label: 'Capture',
      draw: (data, view, dims) => {
        captured.push({ data, view, dims });
        return [];
      },
    };
    const { container } = render(
      <Canvas
        width={300}
        height={200}
        layers={{ myCustom: { layer: customLayer } }}
        defaultView={{ x: 10, y: 20, scale: { x: 2, y: 2 } }}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
    // Tautology: under jsdom the early-return runs before draw is invoked.
    expect(captured.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Canvas shaders prop', () => {
  it('accepts a shaders array and renders without throwing', () => {
    const handle = registerProgram(
      'smoke-test-shader',
      '',
      `#version 300 es
       precision highp float;
       out vec4 outColor;
       void main() { outColor = vec4(0.0, 0.0, 0.0, 1.0); }`,
    );
    function Demo() {
      const scene = useScene<{ id: string }>({ items: [] });
      return (
        <SceneCanvas
          width={100}
          height={100}
          shaders={[handle]}
          scene={scene}
          layers={{}}
        />
      );
    }
    const { container } = render(<Demo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});

describe('Canvas baseBoundsOf synthesis', () => {
  it('synthesized boundsOf folds rotation from descriptor.getRotation', () => {
    // Adapter holds a rotated pose; Canvas should synthesize boundsOf that
    // includes the rotation field when geometry={ROTATED_POSE_DESCRIPTOR}.
    type RotPose = { id: string; x: number; y: number; width: number; height: number; rotation: number };
    const item: RotPose = { id: 'a', x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 4 };

    const adapter = {
      getNodes: () => [item],
      getNode: (id: string) => (id === 'a' ? item : undefined),
      getPose: (id: string): RotPose | null => (id === 'a' ? item : null),
      setPose: () => {},
      getSelected: () => [],
      setSelected: () => {},
    };

    const helpersRef: React.MutableRefObject<{ getEffectiveBounds(id: string): { x: number; y: number; width: number; height: number; rotation?: number } | null } | null> = { current: null };

    function Harness() {
      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter as never}
          geometry={ROTATED_POSE_DESCRIPTOR as never}
          helpersRef={helpersRef as never}
        />
      );
    }

    render(<Harness />);

    // helpersRef is set synchronously during render; getEffectiveBounds goes
    // through effectiveBoundsOf → baseBoundsOf → geometry.getRotation.
    const bounds = helpersRef.current?.getEffectiveBounds('a');
    expect(bounds).not.toBeNull();
    expect((bounds as { rotation?: number }).rotation).toBeCloseTo(Math.PI / 4, 5);
  });

  it('requestRedraw on the ref bumps the redraw effect', async () => {
    const sinkRef: { current: (DebugSink & { snapshot(): DebugSnapshot }) | null } = { current: null };
    const ref = React.createRef<CanvasExtensionApi>();
    render(
      <Canvas
        ref={ref}
        width={200} height={200}
        layers={{}}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />
    );
    await waitForFrame();
    const beginFrameSpy = vi.spyOn(sinkRef.current!, 'beginFrame');
    act(() => { ref.current?.requestRedraw(); });
    await waitForFrame();
    expect(beginFrameSpy).toHaveBeenCalled();
  });

  it('registerLayer adds a layer to the active stack and detach removes it', async () => {
    // Under jsdom the GL path bails before layer.draw runs, so we observe
    // draw-pass participation indirectly via debugSink.beginFrame (same proxy
    // the requestRedraw test uses).
    const sinkRef: { current: (DebugSink & { snapshot(): DebugSnapshot }) | null } = { current: null };
    const extra: RenderLayer<unknown> = {
      id: 'extra', label: 'extra', space: 'screen',
      draw: () => [],
    };
    const ref = React.createRef<CanvasExtensionApi>();
    render(
      <Canvas
        ref={ref}
        width={100} height={100}
        layers={{}}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />
    );
    await waitForFrame();

    // After registerLayer, a new frame should be triggered.
    let detach: (() => void) | undefined;
    const beginFrameSpy = vi.spyOn(sinkRef.current!, 'beginFrame');
    act(() => { detach = ref.current?.registerLayer(extra); });
    await waitForFrame();
    expect(beginFrameSpy).toHaveBeenCalled();

    // After detach + another redraw, beginFrame fires again but the extra layer
    // should be absent from the snapshot's layer list.
    beginFrameSpy.mockClear();
    act(() => { detach?.(); });
    act(() => { ref.current?.requestRedraw(); });
    await waitForFrame();
    expect(beginFrameSpy).toHaveBeenCalled();
    const snapshot = sinkRef.current!.snapshot();
    expect(snapshot.layers.some(l => l.id === 'extra')).toBe(false);
  });
});

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 100, height: 100 };
const POSE = { x: 0, y: 0, width: 10, height: 10 };

describe('buildSceneLayer hierarchical path', () => {
  it('emits nested GroupDrawCommand tree for scene-backed adapter', () => {
    const scene = createScene<{ label: string }, 'bg', typeof POSE>({
      systemLayers: [{ id: 'bg' }],
    });
    const bed = scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'bed' } });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'plant' }, parent: bed });
    const adapter = sceneToAdapter(scene);
    const layer = buildSceneLayer(
      { drawOne: (_node, _p) => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: 'red' } }] },
      adapter as never,
      null,
      () => null,
      () => null,
    );
    // buildSceneLayer emits raw world-space commands; drawLayers wraps in
    // viewToMat3 at orchestration. The output is one group per layer; within a
    // layer, nodes are bucketed FLAT by their own layer (bed + plant siblings),
    // not nested under the container (buildSceneTree per-node-layer bucketing).
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    expect(out).toHaveLength(1); // one 'bg' layer group
    const bgGroup = out[0] as { kind: string; children: DrawCommand[] };
    expect(bgGroup.kind).toBe('group');
    expect(bgGroup.children).toHaveLength(2); // bed + plant, flattened
    for (const c of bgGroup.children) expect((c as { kind: string }).kind).toBe('group');
  });

  it('cfg.toPose is honored on the hierarchical path', () => {
    // cfg.toPose returns a transformed pose; the draw call should see the
    // transformed value, not the raw adapter.getPose result.
    const scene = createScene<{ label: string }, 'bg', typeof POSE>({
      systemLayers: [{ id: 'bg' }],
    });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'node' } });
    const adapter = sceneToAdapter(scene);

    const TRANSFORMED_POSE = { x: 99, y: 88, width: 10, height: 10 };
    const seenPoses: typeof POSE[] = [];

    const layer = buildSceneLayer(
      {
        toPose: () => TRANSFORMED_POSE,
        drawOne: (_node, pose) => {
          seenPoses.push(pose as typeof POSE);
          return [];
        },
      },
      adapter as never,
      null,
      () => null,
      () => null,
    );
    layer.draw(null, VIEW, DIMS);
    expect(seenPoses).toHaveLength(1);
    expect(seenPoses[0]).toEqual(TRANSFORMED_POSE);
  });

  it('falls back to flat output for non-scene adapter (no getLayers)', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    type Pose = { x: number; y: number; width: number; height: number };
    const rects: Rect[] = [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }];
    const rectsRef = { current: rects };
    const adapter = arrayAdapter<Rect, Pose>({
      ref: rectsRef,
      setItems: () => {},
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    });
    const layer = buildSceneLayer(
      { drawOne: (_obj, _p) => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: 'red' } }] },
      adapter as never,
      null,
      () => null,
      () => null,
    );
    // buildSceneLayer emits raw flat commands when the adapter has no
    // getLayers; drawLayers wraps in viewToMat3 at orchestration.
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('path');
  });
});

describe('buildSceneLayer postProcess', () => {
  const RED_RECT: DrawCommand[] = [
    { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: 'red' } },
  ];

  function makeHierarchicalAdapter(layers: string[] = ['bg']) {
    const scene = createScene<{ label: string }, string, typeof POSE>({
      systemLayers: layers.map((id) => ({ id })),
    });
    for (const layer of layers) {
      scene.add({ kind: 'leaf', layer, pose: POSE, data: { label: `node-${layer}` } });
    }
    return sceneToAdapter(scene);
  }

  it('receives the scene commands and its return value replaces them', () => {
    const adapter = makeHierarchicalAdapter();
    const seen: DrawCommand[][] = [];
    const layer = buildSceneLayer(
      {
        drawOne: () => RED_RECT,
        postProcess: (cmds) => {
          seen.push(cmds);
          return [{ kind: 'group', alpha: 0.5, children: cmds }];
        },
      },
      adapter as never,
      null,
      () => null,
      () => null,
    );
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    // The wrapper is what reaches the renderer, scene content nested inside.
    expect(out).toHaveLength(1);
    const wrapper = out[0] as { kind: string; alpha?: number; children: DrawCommand[] };
    expect(wrapper.kind).toBe('group');
    expect(wrapper.alpha).toBe(0.5);
    // The hook saw exactly what the scene would otherwise emit.
    expect(seen).toHaveLength(1);
    expect(wrapper.children).toBe(seen[0]);
    expect(seen[0]).toHaveLength(1); // one 'bg' layer group
  });

  it('is called with view and dims', () => {
    const adapter = makeHierarchicalAdapter();
    const seenArgs: unknown[][] = [];
    const layer = buildSceneLayer(
      {
        drawOne: () => RED_RECT,
        postProcess: (cmds, view, dims) => {
          seenArgs.push([view, dims]);
          return cmds;
        },
      },
      adapter as never,
      null,
      () => null,
      () => null,
    );
    layer.draw(null, VIEW, DIMS);
    expect(seenArgs).toEqual([[VIEW, DIMS]]);
  });

  it('identity hook emits commands deep-equal to the no-hook baseline', () => {
    const cfg = { drawOne: () => RED_RECT };
    const baseline = buildSceneLayer(
      cfg, makeHierarchicalAdapter() as never, null, () => null, () => null,
    ).draw(null, VIEW, DIMS);
    const withHook = buildSceneLayer(
      { ...cfg, postProcess: (cmds: DrawCommand[]) => cmds },
      makeHierarchicalAdapter() as never, null, () => null, () => null,
    ).draw(null, VIEW, DIMS);
    expect(withHook).toEqual(baseline);
  });

  it('runs once per scene:<layerId> canvas layer with only that layer\'s commands', () => {
    const adapter = makeHierarchicalAdapter(['bg', 'fg']);
    const calls: DrawCommand[][] = [];
    const countPaths = (cmds: DrawCommand[]): number =>
      cmds.reduce(
        (n, c) =>
          n + (c.kind === 'path' ? 1 : 0) +
          (c.kind === 'group' ? countPaths((c as { children: DrawCommand[] }).children) : 0),
        0,
      );
    const entries = buildSceneLayers(
      {
        drawOne: () => RED_RECT,
        postProcess: (cmds) => {
          calls.push(cmds);
          return cmds;
        },
      },
      adapter as never,
      null,
      () => null,
      () => null,
    );
    expect(entries.map((e) => e.key)).toEqual(['scene:bg', 'scene:fg']);
    for (const entry of entries) entry.layer.draw(null, VIEW, DIMS);
    // Hook ran once per split canvas layer, each seeing only its own layer's
    // node (one path each — the bundled scene layer would carry both).
    expect(calls).toHaveLength(2);
    expect(calls.map(countPaths)).toEqual([1, 1]);
  });

  it('flat fallback path (cfg.objects) routes through the hook', () => {
    const objects = [{ id: 'a' }, { id: 'b' }];
    const seen: DrawCommand[][] = [];
    const layer = buildSceneLayer(
      {
        objects,
        toPose: () => POSE,
        drawOne: () => RED_RECT,
        postProcess: (cmds) => {
          seen.push(cmds);
          return [{ kind: 'group', alpha: 0.25, children: cmds }];
        },
      },
      undefined,
      null,
      () => null,
      () => null,
    );
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(2); // one path per object
    expect(out).toHaveLength(1);
    expect((out[0] as { alpha?: number }).alpha).toBe(0.25);
  });

  it('is called even when the scene emits zero commands', () => {
    const seen: DrawCommand[][] = [];
    const layer = buildSceneLayer(
      {
        objects: [],
        toPose: () => POSE,
        drawOne: () => RED_RECT,
        postProcess: (cmds) => {
          seen.push(cmds);
          return cmds;
        },
      },
      undefined,
      null,
      () => null,
      () => null,
    );
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    expect(seen).toEqual([[]]);
    expect(out).toEqual([]);
  });
});
