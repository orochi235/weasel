import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { Scene } from 'core/scene/types';
import { useSelection } from '../core/selection/useSelection';

type D = { kind: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

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

function setup() {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  let id = '' as NodeId;
  scene.batch('seed', () => {
    id = scene.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main', pose: { x: 100, y: 100, width: 80, height: 60 } });
  });
  const onClick = vi.fn();
  function Harness({ scene }: { scene: Scene<D, L, P> }) {
    const selection = useSelection({ scene, mode: 'single' });
    return (
      <SceneCanvas features={['pick']} scene={scene} selection={selection} layers={{}} width={400} height={400}
        onClick={(hit) => onClick(hit, selection.get())}
      />
    );
  }
  const { container } = render(<Harness scene={scene} />);
  const canvas = container.querySelector('canvas')!;
  const click = (x: number, y: number) => act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  });
  return { id, onClick, click };
}

describe('SceneCanvas onClick', () => {
  it('fires with the hit node, after the pick has landed', () => {
    const { id, onClick, click } = setup();
    click(140, 130);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]).toEqual([{ id, kind: expect.any(String) }, [id]]);
  });

  it('fires again on a node that is already picked', () => {
    const { id, onClick, click } = setup();
    click(140, 130);
    click(140, 130);
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onClick.mock.calls[1]).toEqual([{ id, kind: expect.any(String) }, [id]]);
  });

  it('fires with null on empty canvas', () => {
    const { onClick, click } = setup();
    click(350, 350);
    expect(onClick.mock.calls[0][0]).toBeNull();
  });
});
