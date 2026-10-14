import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Canvas } from './testing/BareCanvas';
import type { RenderLayer } from 'core/layers/render';
import { stubCanvasContext } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('hover on a layer nobody can see', () => {
  const tracker = (onUncapturedMove: () => void): RenderLayer<unknown> => ({
    id: 'tracker', label: 'tracker', space: 'screen', draw: () => [], onUncapturedMove,
  });

  it('is not delivered to a layer hidden by layerVisibility', () => {
    const moveSpy = vi.fn();
    const layers = { tracker: { layer: tracker(moveSpy) } };
    const { container, rerender } = render(
      <Canvas width={100} height={100} layers={layers} layerVisibility={{ tracker: false }} />,
    );
    fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 10, clientY: 20 });
    expect(moveSpy).not.toHaveBeenCalled();

    rerender(<Canvas width={100} height={100} layers={layers} layerVisibility={{ tracker: true }} />);
    fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 10, clientY: 20 });
    expect(moveSpy).toHaveBeenCalledTimes(1);
  });

  it('is not delivered to a layer left out of layerOrder', () => {
    const moveSpy = vi.fn();
    const { container } = render(
      <Canvas width={100} height={100} layers={{ tracker: { layer: tracker(moveSpy) } }} layerOrder={[]} />,
    );
    fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 10, clientY: 20 });
    expect(moveSpy).not.toHaveBeenCalled();
  });

  it('is not delivered through a detached input element either', () => {
    const moveSpy = vi.fn();
    const input = document.createElement('div');
    const surface = document.createElement('canvas');
    document.body.append(input);
    render(
      <Canvas
        width={100} height={100} layers={{ tracker: { layer: tracker(moveSpy) } }}
        layerVisibility={{ tracker: false }}
        paintInto={{ canvas: surface, x: 0, y: 0 }} inputElement={input}
      />,
    );
    input.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 20, bubbles: true }));
    expect(moveSpy).not.toHaveBeenCalled();
    input.remove();
  });
});

describe('hover while a pointer is held', () => {
  it('stays off until the last of two pointers is released', () => {
    const moveSpy = vi.fn();
    const layer: RenderLayer<unknown> = {
      id: 'tracker', label: 'tracker', space: 'screen', draw: () => [], onUncapturedMove: moveSpy,
    };
    const { container } = render(<Canvas width={100} height={100} layers={{ tracker: { layer } }} />);
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { pointerId: 1 });
    fireEvent.pointerDown(canvas, { pointerId: 2 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 10, clientY: 20 });
    expect(moveSpy).not.toHaveBeenCalled();
    fireEvent.pointerUp(canvas, { pointerId: 2 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 10, clientY: 20 });
    expect(moveSpy).toHaveBeenCalledTimes(1);
  });
});
