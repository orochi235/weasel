import { describe, expect, it } from 'vitest';
import { createScene } from '../../core/scene/scene';
import { asNodeId, type RectPose, type Scene } from '../../core/scene/types';
import { createFrameWriter } from './frameWriter';
import { createSceneMirror } from './sceneMirror';

type D = { fill?: string };
type AnyScene = Scene<unknown, string, unknown>;
const id = asNodeId;
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** A page scene and the worker's copy, each frame applied in the order the worker applies it. */
function pair() {
  const page = createScene<D, 'main' | 'top', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'top' }],
    initial: [
      { id: id('g'), kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} },
      { id: id('a'), kind: 'mark', layer: 'main', parent: id('g'), pose: { x: 1, y: 0, width: 10, height: 10 }, data: {} },
    ],
  });
  const writer = createFrameWriter();
  const mirror = createSceneMirror();
  page.overrides.subscribe(() => writer.overridesChanged());
  const sync = () => {
    const msg = structuredClone(writer.write({ scene: page as unknown as AnyScene, view: VIEW, width: 10, height: 10, dpr: 1 }));
    if (msg.scene) mirror.apply(msg.scene);
    if (msg.overrides) mirror.setOverrides(msg.overrides);
    if (msg.scroll) mirror.setScroll(msg.scroll);
    return msg;
  };
  sync();
  return { page, sync, copy: () => mirror.scene as unknown as typeof page };
}

describe('frameWriter', () => {
  it('keeps scroll offsets and pose overrides through a reset the layer stack caused', () => {
    const { page, sync, copy } = pair();
    page.scroll.set(id('g'), { x: 5, y: -2 });
    page.overrides.set(id('a'), { pose: { x: 40, y: 0, width: 10, height: 10 } });
    sync();
    page.setLayerVisible('top', false);
    expect(sync().scene).toHaveProperty('reset');
    expect(copy().scroll.get(id('g'))).toEqual({ x: 5, y: -2 });
    expect(copy().overrides.read(id('a'))?.pose).toEqual({ x: 40, y: 0, width: 10, height: 10 });
  });
});
