import { describe, expect, it, vi } from 'vitest';
import type { DragState } from './DragDropRuntime';
import { withDragFeedback } from './feedbackLayer';

describe('withDragFeedback', () => {
  it('rings the pointer in the host CSS pixels when an ancestor transform scales it', () => {
    const host = document.createElement('div');
    host.getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 200 }) as DOMRect;
    Object.defineProperty(host, 'offsetWidth', { value: 200 });
    Object.defineProperty(host, 'offsetHeight', { value: 100 });
    const drag = {
      item: {},
      from: host,
      screenPos: { x: 50, y: 40 },
      feedback: { ok: true },
    } as unknown as DragState;
    const [layer] = withDragFeedback([], drag, { current: host });
    const arc = vi.fn();
    const ctx = {
      save() {},
      restore() {},
      beginPath() {},
      stroke() {},
      arc,
    } as unknown as CanvasRenderingContext2D;
    layer.render(ctx, { panX: 0, panY: 0, zoom: { x: 1, y: 1 } } as never, undefined as never);
    expect(arc.mock.calls[0].slice(0, 2)).toEqual([20, 10]);
  });
});
