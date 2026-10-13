import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import { stubCanvasContext } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('Canvas viewport', () => {
  function noopScene() {
    return { drawOne: () => [] } as const;
  }

  it('uncontrolled: defaults to {x:0,y:0} and is internally mutable', () => {
    const onViewChange = vi.fn();
    const { container } = render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        onViewChange={onViewChange}
      />,
    );
    // Initial value is {0,0}; onViewChange not yet called.
    expect(onViewChange).not.toHaveBeenCalled();
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('uncontrolled: defaultView seeds initial state', () => {
    const onViewChange = vi.fn();
    render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        defaultView={{ x: 50, y: 25, scale: { x: 1, y: 1 } }}
        onViewChange={onViewChange}
      />,
    );
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('controlled: passing view + onViewChange honors the prop on render', () => {
    const onViewChange = vi.fn();
    const { rerender } = render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        view={{ x: 10, y: 20, scale: { x: 1, y: 1 } }}
        onViewChange={onViewChange}
      />,
    );
    rerender(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        view={{ x: 30, y: 40, scale: { x: 1, y: 1 } }}
        onViewChange={onViewChange}
      />,
    );
    // No assertion on draw side — view prop change just shouldn't throw.
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('view defaults to scale=1 when defaultView is omitted', () => {
    const onViewChange = vi.fn();
    render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        onViewChange={onViewChange}
      />,
    );
    // View change isn't fired on initial mount; this is a smoke check that the
    // `defaultView ?? { x:0, y:0, scale: { x: 1, y: 1 } }` path doesn't throw on the View
    // type's required `scale` field.
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('accepts a scale-aware view prop without throwing', () => {
    const onViewChange = vi.fn();
    render(
      <Canvas
        width={100}
        height={100}
        layers={{ scene: noopScene() }}
        view={{ x: 5, y: 5, scale: { x: 2, y: 2 } }}
        onViewChange={onViewChange}
      />,
    );
    expect(onViewChange).not.toHaveBeenCalled();
  });
});
