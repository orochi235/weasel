import { describe, expect, it } from 'vitest';
import { createScene } from '../../core/scene/scene';
import { asNodeId, type AddNodeSpec, type RectPose, type Scene } from '../../core/scene/types';
import { createSceneDiff } from './sceneDiff';
import { createSceneMirror, wireOverrides, wireScroll } from './sceneMirror';
import { scenePickIds } from '../scenePickIds';

type D = { fill?: string };
type S = Scene<D, 'main' | 'top', RectPose>;
const id = asNodeId;
const box = (k: string, x: number, extra: Partial<AddNodeSpec<D, 'main' | 'top', RectPose>> = {}) => ({
  id: id(k), kind: 'mark' as const, layer: 'main' as const, pose: { x, y: 0, width: 10, height: 10 }, data: {}, ...extra,
});
const sceneOf = () => createScene<D, 'main' | 'top', RectPose>({
  systemLayers: [{ id: 'main' }, { id: 'top' }],
  initial: [box('g', 0, { kind: 'group' }), box('a', 1, { parent: id('g') }), box('b', 2), box('c', 3)],
});

/** A page scene, the worker's copy of it, and a sync that carries one delta across. */
function pair() {
  const page = sceneOf();
  const diff = createSceneDiff();
  const mirror = createSceneMirror();
  const sync = () => {
    const delta = diff.next(page as unknown as Scene<unknown, string, unknown>);
    if (delta) mirror.apply(structuredClone(delta));
    return delta;
  };
  sync();
  const copy = () => mirror.scene as unknown as S;
  return { page, sync, copy };
}

describe('the render worker scene copy', () => {
  it('starts from a reset and matches the page', () => {
    const { page, copy } = pair();
    expect(copy().toJSON()).toEqual(page.toJSON());
  });

  it('sends nothing when nothing changed, and only the changed node when one did', () => {
    const { page, sync, copy } = pair();
    expect(sync()).toBeNull();
    page.setPose(id('b'), { x: 50, y: 0, width: 10, height: 10 });
    const delta = sync();
    expect(delta).toEqual({ nodes: [expect.objectContaining({ id: 'b' })] });
    expect(copy().get(id('b'))!.pose.x).toBe(50);
  });

  it('follows data, removals, additions, reparenting and reorders', () => {
    const { page, sync, copy } = pair();
    page.update(id('a'), { data: { fill: 'red' } });
    page.remove(id('c'));
    page.add(box('d', 9, { parent: id('g') }));
    page.move(id('b'), id('g'), 0);
    sync();
    expect(copy().toJSON()).toEqual(page.toJSON());
    page.reorder(id('d'), 0);
    sync();
    expect(copy().toJSON()).toEqual(page.toJSON());
    expect([...copy().renderOrder()]).toEqual([...page.renderOrder()]);
  });

  it('numbers nodes as the page does, though the copy is asked in another order', () => {
    const page = sceneOf();
    const diff = createSceneDiff();
    const mirror = createSceneMirror();
    // The page numbers c and b first, as a pick of them would.
    const pageIds = scenePickIds(page);
    const [c, b] = [pageIds.idOf('c'), pageIds.idOf('b')];
    const sync = () => { const d = diff.next(page as unknown as Scene<unknown, string, unknown>); if (d) mirror.apply(structuredClone(d)); };
    sync();
    const copyIds = scenePickIds(mirror.scene!);
    for (const k of ['g', 'a', 'b', 'c']) expect(copyIds.nodeOf(pageIds.idOf(k))).toBe(k);
    expect([copyIds.idOf('c'), copyIds.idOf('b')]).toEqual([c, b]);
    page.remove(id('a'));
    page.add(box('d', 9));
    sync();
    expect(copyIds.nodeOf(pageIds.idOf('d'))).toBe('d');
    expect(copyIds.idOf('d')).toBe(pageIds.idOf('d'));
    expect(copyIds.nodeOf(pageIds.idOf('c'))).toBe('c');
  });

  it('resets when the layer stack changes', () => {
    const { page, sync, copy } = pair();
    page.setLayerVisible('top', false);
    expect(sync()).toHaveProperty('reset');
    expect(copy().layers.find((l) => l.id === 'top')!.visible).toBe(false);
  });

  it('carries pose overrides, with the data they show evaluated on the page', () => {
    const { page, copy } = pair();
    page.overrides.set(id('b'), { pose: { x: 70, y: 0, width: 10, height: 10 }, alpha: 0.5, data: () => ({ fill: 'blue' }) });
    const mirror = createSceneMirror();
    mirror.apply({ reset: structuredClone(page.toJSON()) as never });
    mirror.setOverrides(structuredClone(wireOverrides(page as unknown as Scene<unknown, string, unknown>)));
    const shown = mirror.scene!.overrides.read(id('b'))!;
    expect(shown.pose).toEqual({ x: 70, y: 0, width: 10, height: 10 });
    expect(shown.alpha).toBe(0.5);
    expect(shown.data!({})).toEqual({ fill: 'blue' });
    expect(copy().overrides.ids()).toEqual([]);
  });

  it('carries scroll offsets', () => {
    const { page, copy } = pair();
    page.scroll.set(id('g'), { x: 5, y: -2 });
    const mirror = createSceneMirror();
    mirror.apply({ reset: structuredClone(page.toJSON()) as never });
    mirror.setScroll(structuredClone(wireScroll(page as unknown as Scene<unknown, string, unknown>)));
    expect(mirror.scene!.scroll.get(id('g'))).toEqual({ x: 5, y: -2 });
    expect([...copy().scroll.ids()]).toEqual([]);
  });
});
