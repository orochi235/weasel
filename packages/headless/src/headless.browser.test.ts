/**
 * A scene rendered from Node through `@weasel-js/headless` comes back with the pixels this
 * browser draws for it through `renderSceneToPixels`.
 *
 * Both sides are Playwright's Chromium launched with the same GPU switches on the same machine
 * (`scripts/chromium-gpu-args.ts`), so they run the same WebGL2 implementation; the same implementation given the same commands is
 * deterministic, so the bytes must be equal. Across GPUs or drivers they need not be, which is why
 * nothing here is compared with committed pixels.
 */
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { renderSceneToPixels, warmRender } from '@weasel-js/core';
import { difference, nodePixels } from '@weasel-js/headless/testing/compareRaster';
import { FIXTURE_RENDER, fixtureScene } from '@weasel-js/headless/testing/fixtureScene';
import { sceneToWire } from '@weasel-js/headless/testing/protocol';

describe('rendering from Node', () => {
  it('returns the pixels the browser renders for the same scene', async () => {
    const scene = fixtureScene();
    const renders = [
      { ...FIXTURE_RENDER, background: '#ffffff' },
      // Transparent: the translucent rect is read back unpremultiplied on both sides.
      { ...FIXTURE_RENDER },
      // Smaller and isotropic, through the same page and context as the two before it.
      { sourceRect: { x: 20, y: 10, width: 40, height: 30 }, scale: { x: 2, y: 2 }, background: '#202020' },
    ];
    // The command channel is JSON, so the scene goes as a saved snapshot would, its paths' typed
    // arrays tagged.
    const saved = sceneToWire(scene);
    const fromNode = await commands.renderInNode(renders.map((r) => ({ ...r, scene: saved })));

    expect(fromNode.images).toHaveLength(renders.length);
    for (const [i, r] of renders.entries()) {
      await warmRender({ render: { scene, ...r } });
      const here = renderSceneToPixels({ scene, ...r });
      const there = nodePixels(fromNode.images[i]!);
      expect([there.width, there.height]).toEqual([here.width, here.height]);
      expect(there.data.length).toBe(here.data.length);
      expect(difference(there.data, here)).toEqual({ pixels: 0, maxStep: 0 });
    }
    // Not a blank canvas on both sides: the red rect is where the fixture put it.
    const first = nodePixels(fromNode.images[0]!);
    const at = (10 * 1.25 | 0) * first.width + (10 * 1.5 | 0);
    expect(Array.from(first.data.subarray(at * 4, at * 4 + 4))).toEqual([0xd0, 0x30, 0x30, 255]);
    expect(fromNode.refusedAfterDispose).toBe(true);
  });
});
