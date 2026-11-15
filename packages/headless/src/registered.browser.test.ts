/**
 * A page script that serves its scenes' registry, composition and quantize rule draws a scene
 * built with them as this browser draws it, and the default page refuses that scene by name.
 * Same machine, same WebGL2 implementation, so the bytes must be equal; see `headless.browser.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { renderSceneToPixels, warmRender } from '@weasel-js/core';
import { difference, nodePixels } from '@weasel-js/headless/testing/compareRaster';
import { sceneToWire } from '@weasel-js/headless/testing/protocol';
import { REGISTERED_RENDER, registeredScene } from '@weasel-js/headless/testing/registeredScene';

describe('a headless page serving scene options', () => {
  it('draws registered clips and derivations, an identity composition and a drawn quantize rule as the browser does', async () => {
    const scene = registeredScene();
    const fromNode = await commands.renderInNode([{ ...REGISTERED_RENDER, scene: sceneToWire(scene) }], 'testing/registeredPage.ts');
    await warmRender({ render: { scene, ...REGISTERED_RENDER } });
    const here = renderSceneToPixels({ scene, ...REGISTERED_RENDER });
    const there = nodePixels(fromNode.images[0]!);
    expect([there.width, there.height]).toEqual([here.width, here.height]);
    expect(difference(there.data, here)).toEqual({ pixels: 0, maxStep: 0 });

    const px = (x: number, y: number) => {
      const at = (y * 2 * here.width + x * 2) * 4;
      return Array.from(here.data.subarray(at, at + 4));
    };
    // Rect stored at world (8, 8), drawn 3 right; clipped to the group's left half, x < 40.
    expect(px(12, 12)).toEqual([0xd0, 0x30, 0x30, 255]);
    expect(px(50, 12)).toEqual([255, 255, 255, 255]);
    // The derived bar under the rect, at y 40–44.
    expect(px(30, 42)).toEqual([0x20, 0x60, 0xff, 255]);
  });

  it('refuses the scene in the default page, naming the missing registry key and the bootstrap', async () => {
    const fromNode = await commands.renderInNode([{ ...REGISTERED_RENDER, scene: sceneToWire(registeredScene()) }]);
    const result = fromNode.images[0]!;
    expect('error' in result && result.error).toMatch(/clipFromPose key 'leftHalf'.*serveHeadlessPage/s);
  });
});
