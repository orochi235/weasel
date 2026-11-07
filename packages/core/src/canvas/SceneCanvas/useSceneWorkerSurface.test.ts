import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { workerInputs } from './useSceneWorkerSurface';

const scene = createScene({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;

describe('what a worker frame reads of a scene canvas', () => {
  it('hides a node an in-flight gesture ghosts, over the caller alphaFor', () => {
    const inputs = workerInputs({
      scene, alphaFor: (id) => (id === 'b' ? 0.5 : 1), sceneSlot: { cull: true }, clock: undefined, previewIds: () => ['a'],
    });
    expect(inputs.alphaFor!('a')).toBe(0);
    expect(inputs.alphaFor!('b')).toBe(0.5);
    expect(inputs.cull).toBe(true);
  });

  it('sends no alpha function while nothing dims a node', () => {
    const inputs = workerInputs({ scene, alphaFor: undefined, sceneSlot: undefined, clock: undefined, previewIds: () => null });
    expect(inputs.alphaFor).toBeUndefined();
  });
});
