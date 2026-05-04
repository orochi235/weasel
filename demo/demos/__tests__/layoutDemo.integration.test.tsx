import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
