import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from '../core/scene/useScene';

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
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      scale: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      font: '',
      textBaseline: '',
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
  });
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('SceneCanvas', () => {
  it('renders a canvas', () => {
    function Demo() {
      const scene = useScene<{ id: string }>({ items: [] });
      return <SceneCanvas scene={scene} width={64} height={64} layers={{}} />;
    }
    const { container } = render(<Demo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
