/**
 * With no mode registry, a key bound both to an anchor action and to its
 * node-level twin reaches the anchor action while anchors are selected in
 * path edit, and the twin otherwise.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { countPathAnchors, polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

type P = { x: number; y: number; width: number; height: number };

function mount() {
  let actions!: { trigger(id: string): void };
  let deps!: { get(key: string): unknown };
  function Grab() {
    actions = useActionsRegistry() as typeof actions;
    deps = useDepRegistry() as typeof deps;
    return null;
  }
  const scene = createScene<Record<string, unknown>, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
  const id = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { path } });
  scene.setSelection([id]);
  render(<SceneCanvas features={['draw']} scene={scene} width={200} height={200}><Grab /></SceneCanvas>);
  const editAnchors = () => deps.get('editAnchors') as { setSelectedAnchors(next: number[]): void };
  const key = (k: string) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
  });
  return { scene, id, actions, editAnchors, key };
}

describe('anchor actions and their node-level twins, with no modes', () => {
  it('deletes the selected anchors, not the node, in path edit', () => {
    const { scene, id, actions, editAnchors, key } = mount();
    act(() => actions.trigger('enterPathEdit'));
    act(() => editAnchors().setSelectedAnchors([1]));
    key('Delete');
    const node = scene.get(id);
    expect(node).toBeDefined();
    expect(countPathAnchors((node!.data as { path: PolygonPath }).path)).toBe(3);
  });

  it('deletes the node when no anchor is selected', () => {
    const { scene, id, key } = mount();
    key('Delete');
    expect(scene.get(id)).toBeUndefined();
  });
});
