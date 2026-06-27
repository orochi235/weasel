import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TransformDemo } from '../TransformDemo';

describe('TransformDemo', () => {
  it('drags a rect via the select tool overlay', () => {
    const { container } = render(<TransformDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Rect 'a' starts at (50,80,90,60); center ≈ (95,110). Click to select, drag +50,+30.
    fireEvent.pointerDown(canvas, { clientX: 95, clientY: 110, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 145, clientY: 140, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 145, clientY: 140, pointerId: 1 });
    // Smoke-only: the canvas survives the drag without throwing and remains in the DOM.
    expect(canvas.isConnected).toBe(true);
  });
});
