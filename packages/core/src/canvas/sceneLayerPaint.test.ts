import { describe, expect, it } from 'vitest';
import { paintedSceneLayers } from './sceneLayerPaint';

describe('paintedSceneLayers', () => {
  it('paints a layer the order names twice once, at its first place', () => {
    const layers = [{ id: 'a' }, { id: 'b' }];
    const out = paintedSceneLayers(layers, { layerOrder: ['scene:a', 'scene:b', 'scene:a'] });
    expect(out.map((l) => l.id)).toEqual(['a', 'b']);
  });
});
