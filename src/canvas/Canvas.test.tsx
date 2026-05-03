import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/react';
import { createRef, useRef, useState } from 'react';
import { Canvas } from './Canvas';
import { useSelection } from '../features/selection/useSelection';
import { useMove } from '../interactions/gestures/move/move';
import { useResize } from '../interactions/gestures/resize/resize';
import { arrayAdapter } from '../core/adapters/arrayAdapter';
import type { RenderLayer } from '../core/layers/render';

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
      setTransform: vi.fn(),
      setLineDash: vi.fn(),
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
        hitBody={() => 'a'}
        onBodyHit={onBodyHit}
        onPointerDown={onPointerDown}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onBodyHit).not.toHaveBeenCalled();
  });

  it('auto-build pointer handler routes through usePointerGestures', () => {
    const onBodyHit = vi.fn();
    const { container } = render(
      <Canvas
        width={50}
        height={50}
        layers={{}}
        hitBody={() => 'a'}
        onBodyHit={onBodyHit}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn(); // jsdom missing
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    expect(onBodyHit).toHaveBeenCalledTimes(1);
  });

  it('passes className and style through', () => {
    const { container } = render(
      <Canvas width={10} height={10} layers={{}} className="x" style={{ display: 'block' }} />,
    );
    const canvas = container.querySelector('canvas')!;
    expect(canvas.className).toBe('x');
    expect(canvas.style.display).toBe('block');
  });

  it('integrates with useSelection (smoke)', () => {
    function TestHarness() {
      const sel = useSelection({ mode: 'multi' });
      return (
        <Canvas
          width={50}
          height={50}
          layers={{}}
          hitBody={() => 'a'}
          selection={sel}
        />
      );
    }
    const { container } = render(<TestHarness />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    // No assertion needed beyond "doesn't throw"; selection state is internal.
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  describe('auto-defaults', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    interface Pose { x: number; y: number; width: number; height: number }

    // jsdom doesn't propagate clientX/Y through fireEvent.pointerDown reliably
    // and getBoundingClientRect returns zeros — so override clientToWorld with
    // a closure-driven fixed point per test invocation.
    let nextWorld: [number, number] = [0, 0];
    const C2W = (_c: HTMLCanvasElement, _x: number, _y: number): [number, number] => nextWorld;

    it('selection auto-instantiates and routes body-hit clicks through it', () => {
      const onBodyHit = vi.fn();
      function Harness() {
        const [rects] = useState<Rect[]>([{ id: 'a', x: 0, y: 0, width: 100, height: 100 }]);
        const rectsRef = useRef(rects);
        rectsRef.current = rects;
        const adapter = arrayAdapter<Rect, Pose>({
          ref: rectsRef,
          setItems: () => {},
          toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        });
        const move = useMove<Rect, Pose>(adapter);
        return (
          <Canvas
            width={100}
            height={100}
            layers={{}}
            move={move}
            clientToWorld={C2W}
            onBodyHit={onBodyHit}
          />
        );
      }
      const { container } = render(<Harness />);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      nextWorld = [10, 10];
      fireEvent.pointerDown(canvas);
      // Default hitBody hit 'a'; selection auto-instance applied the click;
      // onBodyHit override fired with the hit ids.
      expect(onBodyHit).toHaveBeenCalledTimes(1);
      expect(onBodyHit.mock.calls[0][0]).toEqual(['a']);
    });

    it('default hitBody scans move.adapter.getObjects() top-most first', () => {
      const onBodyHit = vi.fn();
      // Two overlapping rects; 'b' is on top in render order (last).
      const rects: Rect[] = [
        { id: 'a', x: 0, y: 0, width: 50, height: 50 },
        { id: 'b', x: 0, y: 0, width: 50, height: 50 },
      ];
      function Harness() {
        const rectsRef = useRef(rects);
        const adapter = arrayAdapter<Rect, Pose>({
          ref: rectsRef,
          setItems: () => {},
          toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        });
        const move = useMove<Rect, Pose>(adapter);
        return (
          <Canvas
            width={50}
            height={50}
            layers={{}}
            move={move}
            clientToWorld={C2W}
            onBodyHit={onBodyHit}
          />
        );
      }
      const { container } = render(<Harness />);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      nextWorld = [5, 5];
      fireEvent.pointerDown(canvas);
      expect(onBodyHit).toHaveBeenCalledTimes(1);
      expect(onBodyHit.mock.calls[0][0]).toEqual(['b']);
      // Outside any rect → no hit.
      onBodyHit.mockClear();
      nextWorld = [100, 100];
      fireEvent.pointerDown(canvas);
      expect(onBodyHit).not.toHaveBeenCalled();
    });

    it('explicit hitBody prop wins over the default', () => {
      const onBodyHit = vi.fn();
      function Harness() {
        const rectsRef = useRef<Rect[]>([{ id: 'real', x: 0, y: 0, width: 50, height: 50 }]);
        const adapter = arrayAdapter<Rect, Pose>({
          ref: rectsRef,
          setItems: () => {},
          toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        });
        const move = useMove<Rect, Pose>(adapter);
        return (
          <Canvas
            width={50}
            height={50}
            layers={{}}
            move={move}
            clientToWorld={C2W}
            hitBody={() => 'override'}
            onBodyHit={onBodyHit}
          />
        );
      }
      const { container } = render(<Harness />);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      // Coords irrelevant — hitBody ignores them. Confirm override fires regardless.
      nextWorld = [999, 999];
      fireEvent.pointerDown(canvas);
      expect(onBodyHit.mock.calls[0][0]).toEqual(['override']);
    });

    it('default boundsOf folds move overlay → adapter fallback for resizeTarget', () => {
      // Verify by observing that resize.start fires with adapter pose when
      // selection has a single id — that path needs boundsOf.
      // We capture by spying on resize.start via a custom resizeTarget.
      // Easier: assert default boundsOf returns adapter pose by exercising
      // single-selection resize-handle hit. Use selection initial=['a'].
      const startSpy = vi.fn();
      function Harness() {
        const rectsRef = useRef<Rect[]>([{ id: 'a', x: 10, y: 10, width: 40, height: 40 }]);
        const adapter = arrayAdapter<Rect, Pose>({
          ref: rectsRef,
          setItems: () => {},
          toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        });
        const move = useMove<Rect, Pose>(adapter);
        const resize = useResize<Rect, Pose>(adapter, {});
        // wrap resize so we can observe start args without losing adapter
        const wrappedResize = { ...resize, start: (...args: Parameters<typeof resize.start>) => {
          startSpy(...args);
          resize.start(...args);
        } };
        const sel = useSelection({ initial: ['a'] });
        return (
          <Canvas
            width={100}
            height={100}
            layers={{}}
            move={move}
            resize={wrappedResize}
            selection={sel}
            clientToWorld={C2W}
            handleHitRadius={8}
          />
        );
      }
      const { container } = render(<Harness />);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      // Click on the top-left handle (rect at 10,10 with size 40 → handle at (10,10)).
      nextWorld = [10, 10];
      fireEvent.pointerDown(canvas);
      // resize.start should have been called for id 'a' — proving boundsOf
      // resolved via the adapter fallback (no overlay was live).
      expect(startSpy).toHaveBeenCalled();
      expect(startSpy.mock.calls[0][0]).toBe('a');
    });

    it('explicit boundsOf prop wins over the default', () => {
      const explicit = vi.fn(() => ({ x: 0, y: 0, width: 1000, height: 1000 }));
      const startSpy = vi.fn();
      function Harness() {
        const rectsRef = useRef<Rect[]>([{ id: 'a', x: 0, y: 0, width: 5, height: 5 }]);
        const adapter = arrayAdapter<Rect, Pose>({
          ref: rectsRef,
          setItems: () => {},
          toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        });
        const move = useMove<Rect, Pose>(adapter);
        const resize = useResize<Rect, Pose>(adapter, {});
        const wrappedResize = { ...resize, start: (...args: Parameters<typeof resize.start>) => {
          startSpy(...args);
          resize.start(...args);
        } };
        const sel = useSelection({ initial: ['a'] });
        return (
          <Canvas
            width={1000}
            height={1000}
            layers={{}}
            move={move}
            resize={wrappedResize}
            selection={sel}
            boundsOf={explicit}
            clientToWorld={C2W}
            handleHitRadius={8}
          />
        );
      }
      const { container } = render(<Harness />);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      // Far from the real 5x5 rect, but inside the explicit 1000x1000 bounds
      // at the bottom-right handle (1000,1000).
      nextWorld = [1000, 1000];
      fireEvent.pointerDown(canvas);
      expect(explicit).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe('selectionMode', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    interface Pose { x: number; y: number; width: number; height: number }

    let nextWorld: [number, number] = [0, 0];
    const C2W = (_c: HTMLCanvasElement, _x: number, _y: number): [number, number] => nextWorld;

    const RECTS: Rect[] = [
      { id: 'a', x: 0,   y: 0, width: 50, height: 50 },
      { id: 'b', x: 100, y: 0, width: 50, height: 50 },
      { id: 'c', x: 200, y: 0, width: 50, height: 50 },
    ];

    function Harness(props: {
      mode: 'single' | 'multi' | 'none';
      initial?: string[];
      onSelChange?: (ids: string[]) => void;
      moveStart?: (ids: string[]) => void;
      resizeStart?: (id: string) => void;
    }) {
      const rectsRef = useRef<Rect[]>(RECTS);
      const adapter = arrayAdapter<Rect, Pose>({
        ref: rectsRef,
        setItems: () => {},
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
      });
      const move = useMove<Rect, Pose>(adapter);
      // When overriding resize, replicate Canvas's multi-mode expandIds so
      // useResize's internal expansion still recognizes the synthetic id.
      const selRef = useRef<{ get: () => string[] } | null>(null);
      const resize = useResize<Rect, Pose>(adapter, {
        expandIds: (ids) => {
          if (ids.length === 1 && ids[0] === '__weasel:multi-selection') {
            return selRef.current?.get() ?? ids;
          }
          return ids;
        },
      });
      const wrappedMove = {
        ...move,
        start: (args: Parameters<typeof move.start>[0]) => {
          props.moveStart?.(args.ids);
          move.start(args);
        },
      };
      const wrappedResize = {
        ...resize,
        start: (...args: Parameters<typeof resize.start>) => {
          props.resizeStart?.(args[0]);
          resize.start(...args);
        },
      };
      const sel = useSelection({ initial: props.initial, mode: props.mode === 'multi' ? 'multi' : 'single' });
      selRef.current = sel;
      props.onSelChange?.(sel.current);
      return (
        <Canvas
          width={300}
          height={50}
          layers={{}}
          adapter={adapter}
          move={wrappedMove}
          resize={wrappedResize}
          selection={sel}
          selectionMode={props.mode}
          clientToWorld={C2W}
          handleHitRadius={6}
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
      nextWorld = [10, 10];
      fireEvent.pointerDown(canvas);
      // shift-click another should still replace (single mode)
      nextWorld = [110, 10];
      {
        const ev = createEvent.pointerDown(canvas);
        Object.defineProperty(ev, 'shiftKey', { value: true });
        fireEvent(canvas, ev);
      }
      rerender(<Harness mode="single" onSelChange={(ids) => seen.push(ids)} />);
      const last = seen[seen.length - 1];
      expect(last).toEqual(['b']);
    });

    it('multi: shift-click extends; clicking selected without shift drags whole set', () => {
      const seen: string[][] = [];
      const moveIds: string[][] = [];
      const { container } = render(
        <Harness
          mode="multi"
          onSelChange={(ids) => seen.push(ids)}
          moveStart={(ids) => moveIds.push(ids)}
        />,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      // click a → [a]
      nextWorld = [10, 10];
      fireEvent.pointerDown(canvas);
      fireEvent.pointerUp(canvas);
      // shift-click b → [a,b]
      nextWorld = [110, 10];
      {
        const ev = createEvent.pointerDown(canvas);
        Object.defineProperty(ev, 'shiftKey', { value: true });
        fireEvent(canvas, ev);
      }
      fireEvent.pointerUp(canvas);
      // Selection should have contained ['a','b'] at some render.
      const sawAB = seen.some((s) => s.length === 2 && s.includes('a') && s.includes('b'));
      expect(sawAB).toBe(true);
      // click on a (already selected, no shift) → selection unchanged, drag whole set
      nextWorld = [10, 10];
      fireEvent.pointerDown(canvas);
      const lastMoveIds = moveIds[moveIds.length - 1];
      expect(new Set(lastMoveIds)).toEqual(new Set(['a', 'b']));
    });

    it('multi: clicking inside the union AABB but on no leaf still drags the set', () => {
      const moveIds: string[][] = [];
      const { container } = render(
        <Harness mode="multi" initial={['a', 'c']} moveStart={(ids) => moveIds.push(ids)} />,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      // (75, 25): inside union of a (0..50) and c (200..250) horizontally? a..c union: x in [0,250]. 75 is in union but in the gap between rects.
      nextWorld = [75, 25];
      fireEvent.pointerDown(canvas);
      expect(moveIds.length).toBe(1);
      expect(new Set(moveIds[0])).toEqual(new Set(['a', 'c']));
    });

    it('multi: corner handle on union AABB starts a group resize', () => {
      const resizeIds: string[] = [];
      const { container } = render(
        <Harness mode="multi" initial={['a', 'b']} resizeStart={(id) => resizeIds.push(id)} />,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      // union AABB of a,b is x:[0,150], y:[0,50]. Bottom-right handle at (150,50).
      nextWorld = [150, 50];
      fireEvent.pointerDown(canvas);
      expect(resizeIds.length).toBe(1);
      // The synthetic group id is what useResize's start sees; useResize then
      // expands via expandIds to [a,b] internally.
      expect(resizeIds[0]).toBe('__weasel:multi-selection');
    });

    it('none: canvas interactions do not mutate the selection', () => {
      const seen: string[][] = [];
      const { container } = render(
        <Harness mode="none" initial={['a']} onSelChange={(ids) => seen.push(ids)} />,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      const before = seen[seen.length - 1];
      nextWorld = [110, 10]; // hit b
      fireEvent.pointerDown(canvas);
      // no rerender expected, but if there were one, selection would still be ['a']
      const after = seen[seen.length - 1];
      expect(after).toEqual(before);
      // clicking empty should also not clear
      nextWorld = [275, 25];
      fireEvent.pointerDown(canvas);
      expect(seen[seen.length - 1]).toEqual(['a']);
    });

    it('none: onBodyHit override still fires', () => {
      const onBodyHit = vi.fn();
      function H() {
        const rectsRef = useRef<Rect[]>(RECTS);
        const adapter = arrayAdapter<Rect, Pose>({
          ref: rectsRef,
          setItems: () => {},
          toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        });
        const move = useMove<Rect, Pose>(adapter);
        return (
          <Canvas
            width={300}
            height={50}
            layers={{}}
            adapter={adapter}
            move={move}
            selectionMode="none"
            clientToWorld={C2W}
            onBodyHit={onBodyHit}
          />
        );
      }
      const { container } = render(<H />);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = vi.fn();
      nextWorld = [10, 10];
      fireEvent.pointerDown(canvas);
      expect(onBodyHit).toHaveBeenCalledTimes(1);
      expect(onBodyHit.mock.calls[0][0]).toEqual(['a']);
    });
  });
});
