import { describe, it, expect } from 'vitest';
import { createScene, sceneFromJSON } from './scene';

type L = 'sky' | 'main' | 'fg';

const make = () => createScene<unknown, L>({
  systemLayers: [{ id: 'sky', parallax: { pan: 0.2 } }, { id: 'main' }],
});

describe('scene layer parallax', () => {
  it('carries the factor a system layer declares, and none by default', () => {
    const scene = make();
    expect(scene.layers[0].parallax).toEqual({ pan: 0.2 });
    expect(scene.layers[1].parallax).toBeUndefined();
  });

  it('takes one on a user layer', () => {
    const scene = make();
    scene.addLayer({ id: 'fg', name: 'Foreground', parallax: { pan: 1.3, zoom: 1.5 } });
    expect(scene.layers[2].parallax).toEqual({ pan: 1.3, zoom: 1.5 });
  });

  it('sets and clears it as an undoable step', () => {
    const scene = make();
    scene.setLayerParallax('main', { pan: 0.5 });
    expect(scene.layers[1].parallax).toEqual({ pan: 0.5 });
    scene.setLayerParallax('main', undefined);
    expect(scene.layers[1].parallax).toBeUndefined();
    scene.undo();
    expect(scene.layers[1].parallax).toEqual({ pan: 0.5 });
    scene.undo();
    expect(scene.layers[1].parallax).toBeUndefined();
  });

  it('records nothing when written untracked, which is how an animation drives it', () => {
    const scene = make();
    scene.untracked(() => scene.setLayerParallax('sky', { pan: 0.4 }));
    expect(scene.layers[0].parallax).toEqual({ pan: 0.4 });
    expect(scene.canUndo()).toBe(false);
  });

  it('round-trips through toJSON', () => {
    const scene = make();
    scene.addLayer({ id: 'fg', name: 'Foreground', parallax: { pan: 1.3 } });
    const json = scene.toJSON();
    expect(json.systemLayers[1].parallax).toBeUndefined();
    const back = sceneFromJSON(json);
    expect(back.layers.map((l) => l.parallax)).toEqual([{ pan: 0.2 }, undefined, { pan: 1.3 }]);
  });
});
