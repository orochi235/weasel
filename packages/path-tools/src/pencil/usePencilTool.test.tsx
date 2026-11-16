import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createScene, drawPreset, SceneCanvas } from '@weasel-js/core';
import { usePencilTool } from './usePencilTool';

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
    function Harness() {
      const pencil = usePencilTool();
      return (
        <SceneCanvas scene={scene} layers={{}} width={400} height={400} features={[drawPreset]}
          defaultTools={['select']} tools={{ pencil }} defaultActiveTool="pencil" />
      );
    }
    const { container } = render(<Harness />);
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

  it('inserts a node whose path is smoothed from the sample trail, not a stub rect', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    function Harness() {
      const pencil = usePencilTool();
      return (
        <SceneCanvas scene={scene} layers={{}} width={400} height={400} features={[drawPreset]}
          defaultTools={['select']} tools={{ pencil }} defaultActiveTool="pencil" />
      );
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    const pointer = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    act(() => {
      pointer('pointerdown', 50, 50);
      pointer('pointermove', 80, 60);
      pointer('pointermove', 120, 80);
      pointer('pointermove', 150, 100);
      pointer('pointerup', 150, 100);
    });
    const ids = [...scene.renderOrder()];
    expect(ids).toHaveLength(1);
    const node = scene.get(ids[0]!) as unknown as { data: { path: { kind: string; commands?: Uint8Array } } };
    // A stub rect would have no command stream.
    expect(node.data.path.kind).toBe('polygon');
    expect(node.data.path.commands!.length).toBeGreaterThan(1);
  });
});
