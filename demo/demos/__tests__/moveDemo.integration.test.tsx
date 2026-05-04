import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MoveDemo } from '../MoveDemo';

describe('MoveDemo (Tool-primitive migration)', () => {
  it('drags a rect via the select tool overlay', () => {
    const { container } = render(<MoveDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Rect 'a' starts at (40,40,60,40). Click its center, drag +50,+30.
    fireEvent.pointerDown(canvas, { clientX: 70, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 120, clientY: 90, pointerId: 1 });
    // Smoke-only: the canvas survives the drag without throwing and remains in the DOM.
    expect(canvas.isConnected).toBe(true);
  });
});
