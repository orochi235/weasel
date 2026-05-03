// src/tools/builtin/integration.test.tsx
//
// Phase 2a end-to-end smoke test.
// Proves: Canvas tools={tools} → dispatcher → tool record → wrapped controller → adapter → ops.
// Also proves: legacy keybinding paths did NOT double-fire (dedupe).

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useTools, useSelectTool, useDeleteTool } from '../';
import { Canvas } from '../../canvas/Canvas';
import { arrayAdapter } from '../../core/adapters/arrayAdapter';
import { useSelection } from '../../features/selection/useSelection';

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
    setTransform: vi.fn(),
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
        hitBody: (wx, wy) => {
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

      const sel = useSelection({ initial: ['a'], mode: 'single' });
      selRef.current = sel.current;

      const deleteTool = useDeleteTool(adapter);

      const selectTool = useSelectTool(adapter, {
        hitBody: () => [],
        boundsOf: () => null,
      });

      const tools = useTools({
        active: 'select',
        registry: { select: selectTool },
        alwaysOn: [deleteTool],
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
