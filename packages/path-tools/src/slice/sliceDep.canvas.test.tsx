/** The slice tool cuts through the `slice` dep `<SceneCanvas>` publishes over its scene, with nothing else wired. */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { rectPath, type Path } from '@weasel-js/geom';
import { asNodeId, createScene, SceneCanvas, type RectPose } from '@weasel-js/core';
import { useSliceTool } from './useSliceTool';
import { drawPreset } from '@weasel-js/editing';

afterEach(() => { cleanup(); });

interface Data { path?: Path; fill?: string }

describe('the slice tool on a canvas', () => {
  it('cuts through the canvas\'s own slice dep', () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({
      id: asNodeId('sq'), kind: 'mark', layer: 'main',
      pose: { x: 0, y: 0, width: 100, height: 100 },
      data: { path: rectPath(0, 0, 100, 100), fill: 'red' },
    });
    function Harness() {
      const slice = useSliceTool();
      return <SceneCanvas<Data, 'main', RectPose> features={[drawPreset]} scene={scene} layers={{}} width={400} height={400} tools={{ slice }} />;
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    const pointer = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'k', code: 'KeyK' })); });
    act(() => {
      pointer('pointerdown', -10, 50);
      pointer('pointermove', 60, 50);
      pointer('pointermove', 120, 50);
      pointer('pointerup', 120, 50);
    });
    expect([...scene.renderOrder()].map((id) => scene.get(id)!).filter((n) => n.kind === 'mark')).toHaveLength(2);
  });
});
