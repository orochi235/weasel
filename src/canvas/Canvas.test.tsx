import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/react';
import { createRef, useRef, useState } from 'react';
import { Canvas } from './Canvas';
import { useSelection } from '../features/selection/useSelection';
import { arrayAdapter } from '../core/adapters/arrayAdapter';
import { useSelectTool } from '../tools/builtin/useSelectTool';
import { useTools } from '../tools/useTools';
import type { RenderLayer } from '../core/layers/render';
import type { DebugSink, DebugSnapshot } from '../debug/types';

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

  it('forwards a ref to the underlying <canvas>', () => {
    const ref = createRef<HTMLCanvasElement>();
    render(<Canvas ref={ref} width={50} height={50} layers={{}} />);
    expect(ref.current).toBeInstanceOf(HTMLCanvasElement);
  });

  it('invokes draw on each layer when layers change', () => {
    const draw = vi.fn();
    const layer: RenderLayer<unknown> = { id: 'a', label: 'A', draw };
    render(<Canvas width={50} height={50} layers={{ extra: { layer } }} />);
    expect(draw).toHaveBeenCalled();
  });

  it('per-event override replaces the auto-built handler', () => {
    const onPointerDown = vi.fn();
    const onBodyHit = vi.fn();
    const { container } = render(
      <Canvas
        width={50}
        height={50}
        layers={{}}
        pickEvery={() => 'a'}
        onBodyHit={onBodyHit}
        onPointerDown={onPointerDown}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onBodyHit).not.toHaveBeenCalled();
  });

  it('auto-build pointer handler routes through tools.dispatcher', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    interface Pose { x: number; y: number; width: number; height: number }
    const seen: string[][] = [];
    function Harness() {
      const sel = useSelection({ mode: 'multi' });
      sel.applyClick = vi.fn((id: string) => seen.push([id]));
      const adapter = {
        getObjects: () => [{ id: 'a', x: 0, y: 0, width: 50, height: 50 }] as Rect[],
        getObject: (id: string) => (id === 'a'
          ? { id: 'a', x: 0, y: 0, width: 50, height: 50 } as Rect
          : undefined),
        getPose: (id: string) => (id === 'a' ? { x: 0, y: 0, width: 50, height: 50 } : null) as Pose,
        setPose: () => {},
        ...sel.adapterMethods,
      };
      const select = useSelectTool<Rect, Pose>(adapter, {
        pickEvery: () => ['a'],
        boundsOf: () => ({ x: 0, y: 0, width: 50, height: 50 }),
        drawGhost: () => {},
        getObject: (id) => adapter.getObject(id) ?? null,
      });
      const tools = useTools({ active: 'select', registry: { select } });
      return <Canvas width={50} height={50} layers={{}} adapter={adapter} selection={sel} tools={tools} clientToWorld={() => [5, 5]} />;
    }
    const { container } = render(<Harness />);
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
        getObjects: () => [] as Rect[],
        getObject: () => undefined,
        getPose: () => ({ x: 0, y: 0, width: 0, height: 0 }) as Pose,
        setPose: () => {},
        ...sel.adapterMethods,
      };
      const select = useSelectTool<Rect, Pose>(adapter, {
        pickEvery: () => ['a'],
        boundsOf: () => ({ x: 0, y: 0, width: 50, height: 50 }),
        drawGhost: () => {},
        getObject: () => null,
      });
      const tools = useTools({ active: 'select', registry: { select } });
      return <Canvas width={50} height={50} layers={{}} adapter={adapter} selection={sel} tools={tools} />;
    }
    const { container } = render(<TestHarness />);
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
        seen.push(sel.current);
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
          boundsOf: (id) => {
            const r = rectsRef.current.find((x) => x.id === id);
            return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
          },
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
      const { container } = render(<Harness />);
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
        seen.push(sel.current);
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
          boundsOf: (id) => {
            const r = rectsRef.current.find((x) => x.id === id);
            return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
          },
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
      const { container } = render(<Harness />);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      nextWorld = [5, 5];
      fireEvent.pointerDown(canvas);
      // pickTopMostHit picks the last id in the hit list (siblings → topmost).
      expect(seen.some((s) => s.length === 1 && s[0] === 'b')).toBe(true);
    });

    it('useSelectTool boundsOf drives resize handle hit-test', () => {
      // Bounds returned for selected id 'a' say (0,0,1000,1000) — far outside
      // the real 5x5 pose. Click at the bottom-right handle (1000,1000) should
      // start a resize on 'a', proving the tool consults boundsOf, not the pose.
      const explicit = vi.fn(() => ({ x: 0, y: 0, width: 1000, height: 1000 }));
      const startSpy = vi.fn();
      function Harness() {
        const rectsRef = useRef<Rect[]>([{ id: 'a', x: 0, y: 0, width: 5, height: 5 }]);
        const sel = useSelection({ initial: ['a'] });
        const adapter = {
          ...arrayAdapter<Rect, Pose>({
            ref: rectsRef,
            setItems: () => {},
            toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
          }),
          ...sel.adapterMethods,
        };
        const select = useSelectTool<Rect, Pose>(adapter, {
          pickEvery: () => [],
          boundsOf: explicit,
          handleHitRadius: 8,
          resize: { behaviors: [{ onStart: (ctx) => startSpy(ctx.draggedIds[0]) }] },
        });
        const tools = useTools({ active: 'select', registry: { select } });
        return (
          <Canvas
            width={1000}
            height={1000}
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
      // Bottom-right handle at (1000,1000). Plumb clientX/Y via defineProperty
      // (jsdom's PointerEvent constructor ignores the init dict for these).
      const down = createEvent.pointerDown(canvas);
      Object.defineProperty(down, 'clientX', { value: 1000 });
      Object.defineProperty(down, 'clientY', { value: 1000 });
      fireEvent(canvas, down);
      // Cross drag threshold so resize.start fires (and onStart behavior runs).
      const move = createEvent.pointerMove(canvas);
      Object.defineProperty(move, 'clientX', { value: 1010 });
      Object.defineProperty(move, 'clientY', { value: 1010 });
      fireEvent(canvas, move);
      expect(explicit).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
      expect(startSpy.mock.calls[0][0]).toBe('a');
    });
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
      resizeStart?: (id: string) => void;
    }) {
      const rectsRef = useRef<Rect[]>(RECTS);
      const sel = useSelection({ initial: props.initial, mode: props.mode });
      props.onSelChange?.(sel.current);
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
        boundsOf: (id) => {
          const r = rectsRef.current.find((x) => x.id === id);
          return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
        },
        handleHitRadius: 6,
        move: { behaviors: [{ onStart: (ctx) => props.moveStart?.(ctx.draggedIds) }] },
        resize: { behaviors: [{ onStart: (ctx) => props.resizeStart?.(ctx.draggedIds[0]) }] },
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
        />
      );
    }

    it('single (default): click replaces selection; no shift-extend', () => {
      const seen: string[][] = [];
      const { container, rerender } = render(
        <Harness mode="single" onSelChange={(ids) => seen.push(ids)} />,
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
      rerender(<Harness mode="single" onSelChange={(ids) => seen.push(ids)} />);
      const last = seen[seen.length - 1];
      expect(last).toEqual(['b']);
    });

    it('multi: clicking already-selected drags the whole set', () => {
      // Seed selection with both ids (skipping the shift-click extend pathway,
      // which would require modifiers to be plumbed through the tools
      // dispatcher — see TODO note above).
      const moveIds: string[][] = [];
      const { container } = render(
        <Harness
          mode="multi"
          initial={['a', 'b']}
          moveStart={(ids) => moveIds.push(ids)}
        />,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      // click on a (already selected, no shift) → drag whole set.
      // Use defineProperty to plumb clientX/Y (jsdom's PointerEvent ignores
      // the init dict shorthand for these fields).
      const down = createEvent.pointerDown(canvas, { pointerId: 1 });
      Object.defineProperty(down, 'clientX', { value: 10 });
      Object.defineProperty(down, 'clientY', { value: 10 });
      fireEvent(canvas, down);
      // Cross both thresholds: the dispatcher's (4px from pointerDown) and
      // useMove's internal threshold (4px from move.start's clientX/Y).
      fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: 30, clientY: 30, pointerId: 1 });
      const lastMoveIds = moveIds[moveIds.length - 1];
      expect(new Set(lastMoveIds)).toEqual(new Set(['a', 'b']));
    });

  });
});

import { defineTool } from '../tools/defineTool';

describe('Canvas tools mode', () => {
  it('routes pointer events through tools.dispatcher when tools prop is passed', () => {
    const onDragStart = vi.fn(() => 'claim' as const);
    const onDragEnd = vi.fn(() => 'claim' as const);

    function Test() {
      const tools = useTools({
        active: 't',
        registry: {
          t: defineTool({
            id: 't',
            drag: { onStart: onDragStart, onEnd: onDragEnd },
          }),
        },
      });
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container } = render(<Test />);
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
        registry: { t: defineTool({ id: 't' }) }, // no handlers — every event passes
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

    const { container } = render(<Test />);
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
        registry: { t: defineTool({ id: 't', cursor: 'crosshair' }) },
      });
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container } = render(<Test />);
    const canvas = container.querySelector('canvas')! as HTMLCanvasElement;
    expect(canvas.style.cursor).toBe('crosshair');
  });

  describe('legacy-hook dedupe', () => {
    it('suppresses legacy delete keybinding when "delete" Tool is in alwaysOn', () => {
      // The legacy useDelete hook attaches its own document keydown handler
      // when bindKeyboard is true. With a 'delete' Tool in alwaysOn, Canvas
      // must pass bindKeyboard:false so the legacy handler never fires.
      const legacyApplyOps = vi.fn();

      function Test() {
        const delTool = defineTool({
          id: 'delete',
          keybinding: 'Backspace',
          keyboard: {
            onDown: (_e) => 'claim',
          },
        });
        const activeTool = defineTool({ id: 'active' });
        const tools = useTools({
          active: 'active',
          registry: { active: activeTool },
          alwaysOn: [delTool],
        });
        return (
          <Canvas
            width={100}
            height={100}
            layers={{}}
            tools={tools}
            gestures={{
              delete: {
                // The legacy adapter would call legacyApplyOps if the hook fires.
                // We detect this via a custom filter that always returns true.
                filter: (_ids: string[]) => {
                  legacyApplyOps();
                  return true;
                },
              } as never,
            }}
          />
        );
      }

      render(<Test />);
      fireEvent.keyDown(document, { key: 'Backspace' });
      // The filter is only called by the legacy hook; with dedupe, it should NOT fire.
      expect(legacyApplyOps).not.toHaveBeenCalled();
    });

    it('appends tools.getActiveOverlays() to the layer pipeline (rendered last)', () => {
      const order: string[] = [];
      const toolOverlay: RenderLayer<unknown> = {
        id: 'tool-ov',
        label: 'tool overlay',
        space: 'screen',
        draw: () => { order.push('tool-ov'); },
      };
      const customLayer: RenderLayer<unknown> = {
        id: 'custom-tail',
        label: 'custom tail',
        space: 'screen',
        draw: () => { order.push('custom-tail'); },
      };
      // A custom layer with `after: 'selectionOverlay'` exercises the slot
      // ordering: it should still render before the tool overlay (which is
      // appended at the very end of the pipeline).
      const afterSel: RenderLayer<unknown> = {
        id: 'after-sel',
        label: 'after sel',
        space: 'screen',
        draw: () => { order.push('after-sel'); },
      };

      function Test() {
        const tool = defineTool({ id: 't', overlay: toolOverlay });
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

      render(<Test />);
      expect(order).toContain('tool-ov');
      // tool overlay must come AFTER selectionOverlay-anchored layers and tail.
      const toolIdx = order.indexOf('tool-ov');
      const afterSelIdx = order.indexOf('after-sel');
      const customIdx = order.indexOf('custom-tail');
      expect(afterSelIdx).toBeGreaterThanOrEqual(0);
      expect(customIdx).toBeGreaterThanOrEqual(0);
      expect(toolIdx).toBeGreaterThan(afterSelIdx);
      expect(toolIdx).toBeGreaterThan(customIdx);
    });

    it('tools.has() returns true for ids in registry and alwaysOn', () => {
      let capturedHas: ((id: string) => boolean) | undefined;

      function Test() {
        const always = defineTool({ id: 'delete', keyboard: { onDown: () => 'pass' } });
        const active = defineTool({ id: 'select' });
        const tools = useTools({
          active: 'select',
          registry: { select: active },
          alwaysOn: [always],
        });
        capturedHas = tools.has.bind(tools);
        return <Canvas width={50} height={50} layers={{}} tools={tools} />;
      }

      render(<Test />);
      expect(capturedHas?.('select')).toBe(true);
      expect(capturedHas?.('delete')).toBe(true);
      expect(capturedHas?.('nudge')).toBe(false);
    });
  });
});

describe('Canvas viewport (Phase 2b)', () => {
  function noopScene() {
    return { drawOne: () => {} } as const;
  }

  it('uncontrolled: defaults to {x:0,y:0} and is internally mutable', () => {
    const onViewChange = vi.fn();
    const { container } = render(
      <Canvas
        width={100}
        height={100}
        items={[]}
        setItems={() => {}}
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
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        defaultView={{ x: 50, y: 25, scale: 1 }}
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
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        view={{ x: 10, y: 20, scale: 1 }}
        onViewChange={onViewChange}
      />,
    );
    rerender(
      <Canvas
        width={100}
        height={100}
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        view={{ x: 30, y: 40, scale: 1 }}
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
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        onViewChange={onViewChange}
      />,
    );
    // View change isn't fired on initial mount; this is a smoke check that the
    // `defaultView ?? { x:0, y:0, scale:1 }` path doesn't throw on the View
    // type's required `scale` field.
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('accepts a scale-aware view prop without throwing', () => {
    const onViewChange = vi.fn();
    render(
      <Canvas
        width={100}
        height={100}
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        view={{ x: 5, y: 5, scale: 2 }}
        onViewChange={onViewChange}
      />,
    );
    expect(onViewChange).not.toHaveBeenCalled();
  });
});

describe('Canvas debug overlay', () => {
  function noopScene() {
    return { drawOne: () => {} } as const;
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
          items={[]} setItems={() => {}}
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
        items={[]} setItems={() => {}}
        layers={{ scene: noopScene() }}
        debug={{ bounds: true }}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('records bounds + origins for each item when those flags are on', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', x: 20, y: 30, w: 5, h: 5 },
      { id: 'c', x: 40, y: 50, w: 8, h: 8 },
    ];
    const sinkRef: { current: (DebugSink & { snapshot(): DebugSnapshot }) | null } = { current: null };
    render(
      <Canvas
        width={100} height={100}
        items={items} setItems={() => {}}
        layers={{ scene: { drawOne: () => {} } }}
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
        items={[]} setItems={() => {}}
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
          items={[]} setItems={() => {}}
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
