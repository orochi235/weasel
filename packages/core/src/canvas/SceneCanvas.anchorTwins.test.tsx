/**
 * With no mode registry, a key bound both to an anchor action and to its
 * node-level twin reaches the anchor action while anchors are selected in
 * path edit, and the twin otherwise.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { countPathAnchors, pathToAnchors, polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
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
  const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { path } });
  scene.setSelection([id]);
  render(<SceneCanvas features={['draw']} scene={scene} width={200} height={200}><Grab /></SceneCanvas>);
  const editAnchors = () => deps.get('editAnchors') as { setSelectedAnchors(next: number[]): void };
  const key = (k: string, shiftKey = false) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, shiftKey, bubbles: true, cancelable: true }));
  });
  const pathOf = () => (scene.get(id)!.data as { path: PolygonPath }).path;
  /** Anchor positions in world space, assuming the path is drawn unscaled at the pose's origin. */
  const worldAnchors = () => {
    const { pose } = scene.get(id)!;
    return pathToAnchors(pathOf()).anchors[0]!.map((a) => ({ x: pose.x + a.x, y: pose.y + a.y }));
  };
  return { scene, id, actions, editAnchors, key, pathOf, worldAnchors };
}

const ARROWS = [
  { key: 'ArrowUp', dx: 0, dy: -1 },
  { key: 'ArrowDown', dx: 0, dy: 1 },
  { key: 'ArrowLeft', dx: -1, dy: 0 },
  { key: 'ArrowRight', dx: 1, dy: 0 },
] as const;

describe('anchor actions and their node-level twins, with no modes', () => {
  it.each(['Delete', 'Backspace'])('%s deletes the selected anchors, not the node, in path edit', (k) => {
    const { scene, id, actions, editAnchors, key, pathOf } = mount();
    act(() => actions.trigger('enterPathEdit'));
    act(() => editAnchors().setSelectedAnchors([1]));
    key(k);
    expect(scene.get(id)).toBeDefined();
    expect(countPathAnchors(pathOf())).toBe(3);
  });

  it('Delete deletes the node when no anchor is selected', () => {
    const { scene, id, key } = mount();
    key('Delete');
    expect(scene.get(id)).toBeUndefined();
  });

  describe.each(ARROWS)('$key', ({ key: k, dx, dy }) => {
    it.each([
      { shift: false, step: 1 },
      { shift: true, step: 10 },
    ])('moves only the selected anchor in path edit (shift: $shift)', ({ shift, step }) => {
      const { actions, editAnchors, key, worldAnchors } = mount();
      act(() => actions.trigger('enterPathEdit'));
      act(() => editAnchors().setSelectedAnchors([2]));
      const before = worldAnchors();
      key(k, shift);
      const after = worldAnchors();
      expect(after[2]).toEqual({ x: before[2]!.x + dx * step, y: before[2]!.y + dy * step });
      expect([after[0], after[1], after[3]]).toEqual([before[0], before[1], before[3]]);
    });

    it('moves the node when no anchor is selected', () => {
      const { scene, id, key, pathOf } = mount();
      const before = pathOf();
      key(k);
      expect(scene.get(id)!.pose).toMatchObject({ x: dx, y: dy });
      expect(pathOf()).toBe(before);
    });
  });
});
