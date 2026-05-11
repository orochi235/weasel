/**
 * z-order regression test for `useSelectTool`'s default `pickEvery`.
 *
 * Drives a real click through the dispatcher onto overlapping rects and
 * asserts the topmost (last in array order = top in paint order) is selected.
 */
import { describe, it, expect } from 'vitest';
import { useRef, useState } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Canvas } from 'canvas/Canvas';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import { useSelection } from 'core/selection/useSelection';
import { useTools } from '../useTools';
import { useSelectTool } from './useSelectTool';
import { asNodeId } from 'core/scene/types';

interface Rect { id: string; x: number; y: number; width: number; height: number }
interface Pose { x: number; y: number; width: number; height: number }

const C2W = (_c: HTMLCanvasElement, cx: number, cy: number): [number, number] => [cx, cy];

describe('useSelectTool — default pickEvery z-order', () => {
  it('click on overlapping rects selects the topmost (last in array)', () => {
    function Harness({ onSel }: { onSel: (ids: readonly string[]) => void }) {
      // A and B fully overlap; B added second → painted on top.
      const [rects, setRects] = useState<Rect[]>([
        { id: 'A', x: 0, y: 0, width: 100, height: 100 },
        { id: 'B', x: 0, y: 0, width: 100, height: 100 },
      ]);
      const rectsRef = useRef(rects);
      rectsRef.current = rects;
      const sel = useSelection({ mode: 'single' });
      // Surface selection externally so the test can assert on it.
      onSel(sel.current);

      const base = arrayAdapter<Rect, Pose>({
        ref: rectsRef,
        setItems: setRects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
      });
      const adapter = { ...base, ...sel.adapterMethods };

      // No pickEvery / boundsOf — relies on the new defaults (rect AABB
      // scan over adapter.getNodes()).
      const selectTool = useSelectTool(adapter, {});
      const tools = useTools({ active: 'select', registry: { select: selectTool } });

      return (
        <Canvas
          width={200} height={200} layers={{}}
          adapter={adapter} selection={sel} tools={tools}
          clientToWorld={C2W}
        />
      );
    }

    let lastSel: readonly string[] = [];
    const onSel = (ids: readonly string[]) => { lastSel = ids; };

    const { container, rerender } = render(<Harness onSel={onSel} />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};

    // Sub-threshold click in the overlap (50, 50). down → tiny move → up.
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50, pointerId: 1 });

    rerender(<Harness onSel={onSel} />);
    expect(lastSel).toEqual([asNodeId('B')]); // topmost wins
  });

  it('three-rect stack: deepest in array wins on click', () => {
    function Harness({ onSel }: { onSel: (ids: readonly string[]) => void }) {
      const [rects, setRects] = useState<Rect[]>([
        { id: 'A', x: 0, y: 0, width: 100, height: 100 },
        { id: 'B', x: 0, y: 0, width: 100, height: 100 },
        { id: 'C', x: 0, y: 0, width: 100, height: 100 },
      ]);
      const rectsRef = useRef(rects);
      rectsRef.current = rects;
      const sel = useSelection({ mode: 'single' });
      onSel(sel.current);

      const base = arrayAdapter<Rect, Pose>({
        ref: rectsRef,
        setItems: setRects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
      });
      const adapter = { ...base, ...sel.adapterMethods };
      const selectTool = useSelectTool(adapter, {});
      const tools = useTools({ active: 'select', registry: { select: selectTool } });
      return (
        <Canvas
          width={200} height={200} layers={{}}
          adapter={adapter} selection={sel} tools={tools}
          clientToWorld={C2W}
        />
      );
    }

    let lastSel: readonly string[] = [];
    const onSel = (ids: readonly string[]) => { lastSel = ids; };

    const { container, rerender } = render(<Harness onSel={onSel} />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};

    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50, pointerId: 1 });

    rerender(<Harness onSel={onSel} />);
    expect(lastSel).toEqual([asNodeId('C')]);
  });
});
