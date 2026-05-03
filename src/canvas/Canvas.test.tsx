import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { Canvas } from './Canvas';
import { useSelection } from '../interactions/useSelection';
import type { RenderLayer } from '../features/layers/render';

// jsdom doesn't implement getContext or pointer capture; stub minimally.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => {
    return {
      canvas: { width: 0, height: 0 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
  });
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('<Canvas>', () => {
  it('renders a <canvas> element with the configured dimensions', () => {
    const layers: RenderLayer<unknown>[] = [];
    const { container } = render(<Canvas width={123} height={45} layers={layers} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // jsdom reports the bare attribute, dpr-multiplied isn't asserted here
    expect(canvas!.getAttribute('width')).toBe('123');
    expect(canvas!.getAttribute('height')).toBe('45');
    expect(canvas!.getAttribute('tabindex')).toBe('0');
  });

  it('forwards a ref to the underlying <canvas>', () => {
    const ref = createRef<HTMLCanvasElement>();
    render(<Canvas ref={ref} width={50} height={50} layers={[]} />);
    expect(ref.current).toBeInstanceOf(HTMLCanvasElement);
  });

  it('invokes draw on each layer when layers change', () => {
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [
      { id: 'a', label: 'A', draw },
    ];
    render(<Canvas width={50} height={50} layers={layers} />);
    expect(draw).toHaveBeenCalled();
  });

  it('per-event override replaces the auto-built handler', () => {
    const onPointerDown = vi.fn();
    const onBodyHit = vi.fn();
    const { container } = render(
      <Canvas
        width={50}
        height={50}
        layers={[]}
        hitBody={() => 'a'}
        onBodyHit={onBodyHit}
        onPointerDown={onPointerDown}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onBodyHit).not.toHaveBeenCalled();
  });

  it('auto-build pointer handler routes through usePointerGestures', () => {
    const onBodyHit = vi.fn();
    const { container } = render(
      <Canvas
        width={50}
        height={50}
        layers={[]}
        hitBody={() => 'a'}
        onBodyHit={onBodyHit}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn(); // jsdom missing
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    expect(onBodyHit).toHaveBeenCalledTimes(1);
  });

  it('passes className and style through', () => {
    const { container } = render(
      <Canvas width={10} height={10} layers={[]} className="x" style={{ display: 'block' }} />,
    );
    const canvas = container.querySelector('canvas')!;
    expect(canvas.className).toBe('x');
    expect(canvas.style.display).toBe('block');
  });

  it('integrates with useSelection (smoke)', () => {
    function TestHarness() {
      const sel = useSelection({ mode: 'multi' });
      return (
        <Canvas
          width={50}
          height={50}
          layers={[]}
          hitBody={() => 'a'}
          selection={sel}
        />
      );
    }
    const { container } = render(<TestHarness />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    // No assertion needed beyond "doesn't throw"; selection state is internal.
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });
});
