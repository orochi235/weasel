import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FillStyle, Stroke } from '@weasel-js/core';
import { StrokeAndFillDemo } from '../StrokeAndFillDemo';

// jsdom's canvas rect is all zeros and the view is identity, so client coords
// are world coords.
function click(canvas: HTMLCanvasElement, x: number, y: number) {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  });
}

function data(id: string): { fill?: FillStyle; stroke?: Stroke; vertexColors?: number[] } {
  return window.__weaselTest!.getScene().nodes.find((n) => n.id === id)!.data as never;
}

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  // `SceneGradientHandles` measures its container; jsdom ships no
  // ResizeObserver, and `useNodeOverlayFrame`'s own tests stub it the same way.
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    class StubRO {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubRO }).ResizeObserver = StubRO;
  }
});

// The test hook installs once and stays bound to the first canvas's scene.
afterEach(() => {
  delete window.__weaselTest;
});

describe('StrokeAndFillDemo', () => {
  it('opens on the rect with both paint slots in the panel', () => {
    const { container } = render(<StrokeAndFillDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fill' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stroke' })).toBeTruthy();
    expect(screen.getByLabelText('Stroke width')).toBeTruthy();
  });

  it('swaps the panel for the vertex swatches when the heptagon is selected', () => {
    const { container } = render(<StrokeAndFillDemo />);
    const canvas = container.querySelector('canvas')!;

    click(canvas, 430, 125);
    expect(screen.queryByRole('button', { name: 'Fill' })).toBeNull();
    expect(screen.getAllByLabelText(/^Vertex \d$/)).toHaveLength(7);
  });

  it('recolors one vertex and leaves the other six alone', () => {
    const { container } = render(<StrokeAndFillDemo />);
    const canvas = container.querySelector('canvas')!;
    const before = data('petal').vertexColors!;

    click(canvas, 430, 125);
    // `ColorField` commits on blur: a native color input fires `change` per
    // tick, and committing each one would be an undo entry per tick.
    act(() => {
      const swatch = screen.getByLabelText('Vertex 1');
      fireEvent.input(swatch, { target: { value: '#000000' } });
      fireEvent.blur(swatch);
    });

    const after = data('petal').vertexColors!;
    expect(after.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(after.slice(4)).toEqual(before.slice(4));
  });

  it('drives the polyline taper from the panel slider', () => {
    const { container } = render(<StrokeAndFillDemo />);
    const canvas = container.querySelector('canvas')!;

    click(canvas, 300, 380);
    act(() => {
      fireEvent.change(screen.getByLabelText('Center width'), { target: { value: '32' } });
    });

    expect(data('ribbon').stroke!.vertexWidths).toEqual([4, 32, 32, 32, 4]);
  });
});
