/**
 * Mod+D reaches `transformAgain` and Mod+Shift+D reaches `duplicate` through a
 * `draw` canvas's dispatcher. jsdom is not a Mac, so Mod is Ctrl.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from '../../../canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { recordTransform } from './memory';

type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

const ID = asNodeId('a');

function setup() {
  const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } });
  scene.setSelection([ID]);
  render(<SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} />);
  const key = (key: string, init: KeyboardEventInit = {}) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
  return { scene, key };
}

describe('transform-again keys', () => {
  it('Mod+D repeats the last transform', () => {
    const t = setup();
    recordTransform(t.scene, { kind: 'translate', dx: 5, dy: 0 }, [ID]);
    t.key('d', { ctrlKey: true });
    expect(t.scene.get(ID)!.pose).toMatchObject({ x: 5, y: 0 });
    expect(t.scene.getSelection()).toEqual([ID]);
  });

  it('Mod+Shift+D duplicates, whatever was last transformed', () => {
    const t = setup();
    recordTransform(t.scene, { kind: 'translate', dx: 5, dy: 0 }, [ID]);
    t.key('D', { ctrlKey: true, shiftKey: true });
    expect(t.scene.get(ID)!.pose).toMatchObject({ x: 0, y: 0 });
    const [copy] = t.scene.getSelection();
    expect(copy).not.toBe(ID);
    expect(t.scene.get(copy)!.pose).toMatchObject({ x: 12, y: 12 });
  });
});
