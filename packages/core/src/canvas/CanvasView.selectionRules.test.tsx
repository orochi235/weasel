/**
 * A view's own selection on a scene canvas holds what the scene's selection would: a node an edit
 * hides, locks or removes leaves it, as it leaves the scene's.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act, render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { createScene } from 'core/scene/scene';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';

type P = { x: number; y: number; width: number; height: number; rotation: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

describe('<CanvasView selection> on a scene canvas', () => {
  it('drops a node hidden, locked or removed while the view holds it', () => {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const add = () => scene.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10, rotation: 0 } });
    const [a, b, c, d] = [add(), add(), add(), add()];
    let api!: SelectionApi;
    function App() {
      api = useSelection({ mode: 'multi' });
      return (
        <SceneCanvas scene={scene} width={200} height={200}>
          <CanvasView id="panel" bounds={{ x: 0, y: 0, w: 100, h: 100 }} selection={api} />
        </SceneCanvas>
      );
    }
    render(<App />);
    act(() => api.set([a, b, c, d]));
    act(() => { scene.setHidden(a, true); scene.setLocked(b, true); scene.remove(c); });
    expect(api.get()).toEqual([d]);
  });
});
