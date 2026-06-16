import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { LayoutDemo } from '../LayoutDemo';

// The canvas backend is GL-only; jsdom can't paint it and won't even hand back
// a usable context without a stub. Stub `getContext` (and pointer-capture) so
// SceneCanvas mounts, hit-tests, and routes the gesture exactly as it does in
// the browser — the committed poses then surface through the demo's ledger.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

/** Read a ledger row: its committed pose text + the parent id on the element. */
function row(container: HTMLElement, id: string): { text: string; parent: string } {
  const el = container.querySelector(`[data-testid="ld-pose-${id}"]`)!;
  return { text: el.textContent!, parent: el.getAttribute('data-parent')! };
}

describe('LayoutDemo', () => {
  it('drags a child from the freeform container into the tileGrid and reflows', () => {
    const { container } = render(<LayoutDemo />);
    const canvas = container.querySelector('canvas')!;
    // jsdom rects are all-zero; the dispatcher's client→world mapping needs a
    // real canvas box. Default view is identity, so client coords == world.
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, x: 0, y: 0, width: 620, height: 260,
      right: 620, bottom: 260, toJSON: () => ({}),
    }) as DOMRect;

    // BEFORE: f1 lives in F at (50,80); g1 lives in G's top-left cell.
    const f1Before = row(container, 'f1');
    const g1Before = row(container, 'g1');
    expect(f1Before).toEqual({ text: 'f1:50,80', parent: 'F' });
    expect(g1Before).toEqual({ text: 'g1:210,40', parent: 'G' });

    // Select f1 first. moveAction binds to `selected-body`, so the drag only
    // routes to move once f1 is in the selection. A sub-threshold press/release
    // on f1's center (65,95) synthesizes the selecting click.
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 65, clientY: 95, pointerId: 1 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 65, clientY: 95, pointerId: 1 }));
    });

    // Drag f1 from its center (65,95) into G's top-left cell. G is at
    // (210,40,180,180); a 2×2 grid → 90×90 cells; the top-left cell centers on
    // (255,85). The first pointermove crosses the 4px drag threshold (forwards
    // the buffered pointerdown → move.start); the threshold-crossing move
    // carries the world delta the layout pass + commit act on. Dropping f1's
    // center inside G's top-left cell makes the tileGrid strategy snap f1 to the
    // cell origin (210,40) and the commit reparents f1 under G.
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 65, clientY: 95, pointerId: 1 }));
    });
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 75, clientY: 95, pointerId: 1 }));
    });
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 255, clientY: 85, pointerId: 1 }));
    });
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 255, clientY: 85, pointerId: 1 }));
    });

    const f1After = row(container, 'f1');

    // f1 reparented into G (the commit's reparent op).
    expect(f1After.parent).toBe('G');
    // f1's committed pose is the tileGrid cell origin (210,40) — proof the
    // destination strategy reflowed the dragged child. A non-layout translate
    // would have produced (240,70); the grid snap is layout-specific.
    expect(f1After.text).toBe('f1:210,40');
    expect(f1After.text).not.toBe(f1Before.text);
  });
});
