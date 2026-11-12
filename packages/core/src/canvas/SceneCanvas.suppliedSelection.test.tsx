/**
 * A selection a consumer keeps off the scene holds what the scene's own would: an edit that hides,
 * locks or removes a selected node takes it out, so no key acts on it.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import type { NodeId } from 'core/scene/types';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number; rotation: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const add = (x: number) => scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x, y: 0, width: 50, height: 50, rotation: 0 } });
  const a = add(0);
  const b = add(100);
  let api!: SelectionApi;
  function App() {
    api = useSelection({ mode: 'multi' });
    return <SceneCanvas scene={scene} width={300} height={300} features={['draw']} selection={api} />;
  }
  render(<App />);
  return { scene, a, b, api: () => api };
}

const press = (key: string) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });

describe('<SceneCanvas selection> kept off the scene', () => {
  it('drops a node hidden while selected, so Delete leaves it', () => {
    const { scene, a, b, api } = mount();
    act(() => api().set([a, b]));
    act(() => scene.setHidden(a, true));
    expect(api().get()).toEqual([b]);
    press('Delete');
    expect([scene.get(a) !== undefined, scene.get(b) !== undefined]).toEqual([true, false]);
  });

  it('drops a node locked or removed while selected', () => {
    const { scene, a, b, api } = mount();
    act(() => api().set([a, b]));
    act(() => scene.setLocked(a, true));
    act(() => scene.remove(b));
    expect(api().get()).toEqual([] as NodeId[]);
  });

  it('reads no locked node the caller wrote to its own selection', () => {
    const { scene, a, b, api } = mount();
    act(() => scene.setLocked(a, true));
    act(() => api().set([a, b]));
    press('Delete');
    expect([scene.get(a) !== undefined, scene.get(b) !== undefined]).toEqual([true, false]);
  });
});
