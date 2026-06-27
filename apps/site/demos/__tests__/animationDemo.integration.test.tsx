import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnimationDemo } from '../AnimationDemo';

describe('AnimationDemo', () => {
  it('renders the canvas and the three control buttons', () => {
    const { container } = render(<AnimationDemo />);
    expect(screen.getByRole('button', { name: /Tween A/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tween B/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add card/i })).toBeTruthy();
    // Canvas component renders a <canvas>; smoke test it survived render.
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('clicking "Add card" does not throw and the canvas remains mounted', () => {
    const { container } = render(<AnimationDemo />);
    const canvas = container.querySelector('canvas')!;
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /Add card/i }));
    }).not.toThrow();
    expect(canvas.isConnected).toBe(true);
  });

  it('clicking "Tween A" does not throw and the canvas remains mounted', () => {
    const { container } = render(<AnimationDemo />);
    const canvas = container.querySelector('canvas')!;
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /Tween A/i }));
    }).not.toThrow();
    expect(canvas.isConnected).toBe(true);
  });
});
