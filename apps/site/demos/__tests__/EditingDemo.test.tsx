import { act, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EditingDemo } from '../EditingDemo';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function click(canvas: Element, x: number, y: number): void {
  const opts = { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, isPrimary: true };
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
    canvas.dispatchEvent(new PointerEvent('pointerup', opts));
  });
}

describe('EditingDemo', () => {
  it('names a part for each preset drawPreset includes', () => {
    render(<EditingDemo />);
    for (const label of ['View', 'Select', 'Move', 'Edit', 'Arrange', 'Pathfinder', 'Ingest']) {
      expect(screen.getByText(label, { selector: 'dt' })).toBeTruthy();
    }
    expect(document.querySelectorAll('dd:empty')).toHaveLength(0);
  });

  it('turns on the edit actions once a click selects a shape', () => {
    const { container } = render(<EditingDemo />);
    const del = () => screen.getByRole('button', { name: /^Delete/ });
    expect(del().hasAttribute('disabled') || del().getAttribute('aria-disabled') === 'true').toBe(true);
    click(container.querySelector('canvas')!, 100, 100);
    expect(del().hasAttribute('disabled') || del().getAttribute('aria-disabled') === 'true').toBe(false);
  });
});
