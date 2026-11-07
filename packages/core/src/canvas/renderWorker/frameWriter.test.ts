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

  it('shows a write to stored data through an override that shows data', () => {
    const { page, sync, copy } = pair();
    page.overrides.set(id('a'), { data: (stored) => ({ ...stored, fill: `${stored.fill ?? 'none'}!` }) });
    sync();
    expect(copy().overrides.read(id('a'))?.data?.({})).toEqual({ fill: 'none!' });
    page.update(id('a'), { data: { fill: 'red' } });
    sync();
    expect(copy().overrides.read(id('a'))?.data?.({})).toEqual({ fill: 'red!' });
  });


  it('carries an override set before its node was added, once the node is', () => {
    const { page, sync, copy } = pair();
    const pose = { x: 30, y: 0, width: 10, height: 10 };
    page.overrides.set(id('z'), { pose });
    sync();
    page.add({ id: id('z'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    sync();
    expect(copy().overrides.read(id('z'))?.pose).toEqual(pose);
  });
  it('forgets the alpha of a removed node, so one put back under its id paints whole', () => {
    const page = createScene<D, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: [{ id: id('a'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 5, height: 5 }, data: {} }],
    });
    const writer = createFrameWriter();
    // The worker's alphas, kept as `serveSceneRender` keeps them.
    const alphas = new Map<string, number>();
    let dim = 0.25;
    const sync = () => {
      const msg = writer.write({
        scene: page as unknown as AnyScene, view: VIEW, width: 10, height: 10, dpr: 1, alphaFor: (n) => (n === 'a' ? dim : 1),
      });
      for (const [n, a] of msg.alpha ?? []) {
        if (a === 1) alphas.delete(n);
        else alphas.set(n, a);
      }
    };
    sync();
    expect(alphas.get('a')).toBe(0.25);
    const node = page.get(id('a'))!;
    page.remove(id('a'));
    sync();
    dim = 1;
    page.add({ id: node.id, kind: node.kind, layer: 'main', pose: node.pose, data: {} });
    sync();
    expect(alphas.has('a')).toBe(false);
  });
});
