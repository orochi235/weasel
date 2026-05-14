import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { asNodeId } from 'core/scene/types';

// jsdom doesn't implement getContext or pointer capture; stub minimally.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

type D = { color: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

/**
 * Drives a pointerdown at (clientX, clientY) on the canvas. Constructs the
 * event explicitly because jsdom's PointerEvent ignores clientX/Y from the
 * dict-init shorthand (matches the Canvas.test.tsx pattern).
 */
function pointerDownAt(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  canvas.setPointerCapture = vi.fn();
  const down = createEvent.pointerDown(canvas, { pointerId: 1 });
  Object.defineProperty(down, 'clientX', { value: clientX });
  Object.defineProperty(down, 'clientY', { value: clientY });
  fireEvent(canvas, down);
}

describe('SceneCanvas defaultTools selector', () => {
  it('omitted defaultTools: resize is registered (corner-drag fires resize.onStart)', () => {
    const resizeStart = vi.fn();
    function Harness() {
      const scene = useScene<D, L, P>({
        systemLayers: [{ id: 'main' }],
        initial: [{
          id: asNodeId('a'),
          kind: 'leaf',
          layer: 'main',
          pose: { x: 0, y: 0, width: 50, height: 50 },
          data: { color: '#f00' },
        }],
      });
      return (
        <SceneCanvas
          scene={scene}
          width={200} height={200}
          layers={{}}
          selectionOptions={{ initial: [asNodeId('a')] }}
          selectTool={{
            handleHitRadius: 8,
            resize: { behaviors: [{ onStart: (ctx: { draggedIds: string[] }) => resizeStart(ctx.draggedIds[0]) }] },
          }}
        />
      );
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    // Drop the pointer at the top-left corner-handle (0,0) of the selected rect.
    // jsdom's getBoundingClientRect is zero, so clientX/Y maps 1:1 to world coords.
    pointerDownAt(canvas, 0, 0);
    expect(resizeStart).toHaveBeenCalled();
    expect(resizeStart.mock.calls[0][0]).toBe('a');
  });

  it("defaultTools=['select']: resize is NOT registered (corner-drag falls through)", () => {
    const resizeStart = vi.fn();
    function Harness() {
      const scene = useScene<D, L, P>({
        systemLayers: [{ id: 'main' }],
        initial: [{
          id: asNodeId('a'),
          kind: 'leaf',
          layer: 'main',
          pose: { x: 0, y: 0, width: 50, height: 50 },
          data: { color: '#f00' },
        }],
      });
      return (
        <SceneCanvas
          scene={scene}
          width={200} height={200}
          layers={{}}
          selectionOptions={{ initial: [asNodeId('a')] }}
          defaultTools={['select']}
          selectTool={{
            handleHitRadius: 8,
            // Resize behavior is registered into selectTool.resize, but with
            // defaultTools=['select'] the resize tool is never mounted — so
            // the spy must never fire.
            resize: { behaviors: [{ onStart: (ctx: { draggedIds: string[] }) => resizeStart(ctx.draggedIds[0]) }] },
          }}
        />
      );
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    // Same corner-handle world point. Without resize registered, the
    // affordance is absent — the click falls through to body-hit move.
    pointerDownAt(canvas, 0, 0);
    expect(resizeStart).not.toHaveBeenCalled();
  });
});
