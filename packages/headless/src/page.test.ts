import { afterEach, describe, expect, it } from 'vitest';
import { planPixelRender } from '@weasel-js/core';
import { serveHeadlessPage } from './page';
import { pageRenderArgs } from './pageLoad';
import { PAGE_GLOBAL, sceneToWire, type PageApi, type PageRequest } from './protocol';
import { REGISTERED_RENDER, REGISTERED_SCENE_OPTIONS, registeredScene } from './testing/registeredScene';

const request = (): PageRequest => ({
  scene: JSON.parse(JSON.stringify(sceneToWire(registeredScene()))) as object,
  ...REGISTERED_RENDER,
  format: 'rgba',
});
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
const root = globalThis as unknown as Record<string, PageApi | undefined>;

afterEach(() => {
  delete root[PAGE_GLOBAL];
});

describe('headless page', () => {
  it('reads a scene back with the options it is served with, into the commands the scene draws', () => {
    const { args } = pageRenderArgs(request(), REGISTERED_SCENE_OPTIONS);
    const direct = json(planPixelRender({ scene: registeredScene(), ...REGISTERED_RENDER }));
    expect(json(planPixelRender(args))).toEqual(direct);
    // Each option draws: read back without the composition, or without the rule, the scene draws elsewhere.
    const { registry, composition, quantize } = REGISTERED_SCENE_OPTIONS;
    for (const partial of [{ registry, quantize }, { registry, composition }]) {
      expect(json(planPixelRender(pageRenderArgs(request(), partial).args))).not.toEqual(direct);
    }
  });

  it('refuses a scene naming a registry key it was not served, naming the bootstrap', () => {
    expect(() => pageRenderArgs(request(), {})).toThrow(/clipFromPose key 'leftHalf'.*serveHeadlessPage\(\{ scene \}\)/s);
    try {
      pageRenderArgs(request(), {});
    } catch (err) {
      expect((err as Error).cause).toMatchObject({ name: 'SnapshotKeyError', id: expect.any(String), field: 'clipFromPose', key: 'leftHalf' });
    }
  });

  it('serves renders under the page global, read with its options, once', async () => {
    serveHeadlessPage();
    // Refused at the read, before anything needs WebGL.
    await expect(root[PAGE_GLOBAL]!.render(request())).rejects.toThrow(/clipFromPose key 'leftHalf'/);
    expect(() => serveHeadlessPage()).toThrow(/already serves/);
    delete root[PAGE_GLOBAL];
    serveHeadlessPage({ scene: REGISTERED_SCENE_OPTIONS });
    // Past the read: jsdom has no WebGL2, so the render itself is what fails.
    await expect(root[PAGE_GLOBAL]!.render(request())).rejects.toThrow(/WebGL2|canvas/);
  });
});
