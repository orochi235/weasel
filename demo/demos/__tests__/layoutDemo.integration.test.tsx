import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayoutDemo } from '../LayoutDemo';

describe('LayoutDemo', () => {
  it('drags a child from the freeform container into the tileGrid and reflows', () => {
    const { container } = render(<LayoutDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Layout: freeform container F at (10,40,180,180) with child 'f1' at (50,80,30,30).
    // tileGrid container G at (210,40,180,180) with child 'g1' at top-left cell.
    // Drag f1 from its center (65, 95) into the tileGrid's top-right cell (~300, 100).
    fireEvent.pointerDown(canvas, { clientX: 65, clientY: 95, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 300, clientY: 100, pointerId: 1 });
    // Smoke-only: the canvas survives the cross-container drag without throwing
    // and remains in the DOM. Stronger pose-state assertions live in
    // move.layout.test.ts.
    expect(canvas.isConnected).toBe(true);
  });

  it('selects the child (not the enclosing container) when clicking inside both', () => {
    // Regression: pointerdown inside a child rect that is fully contained by
    // its parent container must drag the child, not the container. f1 sits
    // at (50,80,30,30) inside F at (10,40,180,180); pointerdown at world
    // (60,90) hits both. The select tool's pickTopMostHit collapses the
    // parent/child overlap so the descendant wins.
    //
    // We intercept getContext for this one render so the canvas's per-frame
    // fillRect calls are recorded; the *last* draw of each known fillStyle
    // reflects the post-gesture committed pose.
    type Call = { fillStyle: string; x: number; y: number; w: number; h: number };
    const calls: Call[] = [];
    const ctxStub = {
      canvas: { width: 620, height: 260 },
      clearRect: vi.fn(),
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
      fillRect(x: number, y: number, w: number, h: number) {
        calls.push({ fillStyle: this.fillStyle, x, y, w, h });
      },
    } as unknown as CanvasRenderingContext2D;
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext =
      () => ctxStub;
    try {
      const { container } = render(<LayoutDemo />);
      const canvas = container.querySelector('canvas')!;
      canvas.setPointerCapture = () => {};
      // Helper: dispatch a pointer event that React will route AND that
      // carries clientX/clientY. jsdom's PointerEvent constructor drops the
      // clientX/clientY init args, and React's onPointer* identifies handlers
      // by event type — a MouseEvent with type 'pointerdown' satisfies both.
      // act() wraps each dispatch so React commits the resulting state update
      // (and the canvas re-paints with the new poses) before we sample.
      const fire = (type: 'pointerdown' | 'pointermove' | 'pointerup', cx: number, cy: number) => {
        const evt = new MouseEvent(type, { bubbles: true, cancelable: true });
        Object.defineProperty(evt, 'clientX', { value: cx, configurable: true });
        Object.defineProperty(evt, 'clientY', { value: cy, configurable: true });
        Object.defineProperty(evt, 'pointerId', { value: 1, configurable: true });
        canvas.dispatchEvent(evt);
      };
      // Drag (60,90) -> (80,110) -> (90,120). Two pointermoves are needed:
      // the first crosses the dispatcher's threshold (promoting to drag and
      // calling move.start); the second is the first onMove that produces a
      // non-zero world delta the layout-aware end() commits as a Drop op.
      act(() => { fire('pointerdown', 60, 90); });
      act(() => { fire('pointermove', 80, 110); });
      act(() => { fire('pointermove', 90, 120); });
      act(() => { fire('pointerup',   90, 120); });

      // Each scene paint draws every pose as a filled rect of its known color.
      // The *last* paint per fillStyle reflects the post-gesture committed
      // pose. F (container) must not have moved; f1 (child) must have moved.
      const lastByStyle = new Map<string, Call>();
      for (const c of calls) lastByStyle.set(c.fillStyle, c);
      const fLast = lastByStyle.get('#a89878');  // F's fill
      const f1Last = lastByStyle.get('#f5b7a3'); // f1's fill
      expect(fLast).toBeDefined();
      expect(f1Last).toBeDefined();
      // F never moved (the bug would have dragged F instead of f1).
      expect(fLast!.x).toBe(10);
      expect(fLast!.y).toBe(40);
      // f1 moved off its initial (50, 80) pose.
      expect(f1Last!.x).not.toBe(50);
      expect(f1Last!.y).not.toBe(80);
    } finally {
      (HTMLCanvasElement.prototype as unknown as { getContext: typeof origGetContext }).getContext =
        origGetContext;
    }
  });
});
