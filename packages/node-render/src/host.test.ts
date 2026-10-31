import { describe, expect, it } from 'vitest';
import { planPixelRender, sceneFromJSON, type SavedScene } from '@weasel-js/core';
import { createNodeRasterHost } from './host';
import { sceneFromWire, sceneToWire } from './protocol';
import { FIXTURE_RENDER, fixtureScene } from './testing/fixtureScene';

describe('node raster host', () => {
  it('sends a scene the page reads back into the same draw commands', () => {
    const scene = fixtureScene();
    const wire = JSON.parse(JSON.stringify(sceneToWire(scene))) as object;
    const plan = (s: typeof scene | ReturnType<typeof sceneFromJSON>) =>
      planPixelRender({ scene: s, ...FIXTURE_RENDER, background: '#ffffff' });
    expect(JSON.parse(JSON.stringify(plan(sceneFromJSON(sceneFromWire(wire) as SavedScene<unknown, string, unknown>))))).toEqual(JSON.parse(JSON.stringify(plan(scene))));
  });

  it('launches nothing until a render, and refuses one once disposed', async () => {
    const host = createNodeRasterHost({ pageScript: 'unused' });
    await host.dispose();
    await host.dispose();
    await expect(host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).rejects.toThrow(/disposed/);
  });
});
