import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';

type D = { kind: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('usePencilTool through <SceneCanvas>', () => {
  it('draws a stroke that starts over a shape, rather than moving the shape', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    let rect!: string;
    scene.batch('seed', () => {
      rect = scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 100, y: 100, width: 80, height: 60 } });
    });
    const { container } = render(
      <SceneCanvas scene={scene} layers={{}} width={400} height={400} features={['draw']}
        defaultTools={['select', 'pencil']} defaultActiveTool="pencil" />,
    );
    const canvas = container.querySelector('canvas')!;
    const pointer = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    act(() => {
      pointer('pointerdown', 120, 120);
      pointer('pointermove', 200, 160);
      pointer('pointermove', 300, 300);
      pointer('pointerup', 300, 300);
    });
    expect([...scene.renderOrder()]).toHaveLength(2);
    expect(scene.get(rect as never)?.pose).toEqual({ x: 100, y: 100, width: 80, height: 60 });
  });
});
