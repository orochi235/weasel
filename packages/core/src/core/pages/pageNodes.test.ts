import { describe, expect, it } from 'vitest';
import { createScene, sceneFromJSON } from '../scene/scene';
import { composeWorldPose } from '../scene/composePose';
import { scenePoseAdapter } from '../scene/scenePoseAdapter';
import type { NodeId } from '../scene/types';
import { createPageRun, isPaged, pageNodeOf, pageOfNode, pageRunOf } from './pageNodes';
import { movePage, pageMembers, pagesOf, placedPagesOf, removePage, renamePage, resizePage } from './pageEdits';

type Pose = { x: number; y: number; width: number; height: number };

function setup() {
  const scene = createScene<{ n: string }, 'paper' | 'ink', Pose>({ systemLayers: [{ id: 'paper' }, { id: 'ink' }] });
  const run = createPageRun(scene, [{ id: 'a', width: 100, height: 50 }, { id: 'b', width: 100, height: 50 }], {
    direction: 'row', gap: 10,
  });
  const child = scene.add({
    kind: 'mark', layer: 'ink', parent: 'b' as NodeId, pose: { x: 5, y: 5, width: 10, height: 10 }, data: { n: 'child' },
  });
  const worldX = (id: NodeId) => (composeWorldPose(
    scenePoseAdapter(scene as never), id, scene.composition.compose as never,
  ) as Pose).x;
  return { scene, run, child, worldX };
}

describe('page nodes', () => {
  it('lays the pages out in a run, on the lowest layer', () => {
    const { scene, run } = setup();
    expect(placedPagesOf(scene).map(({ id, x, y }) => ({ id, x, y }))).toEqual([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 110, y: 0 }]);
    expect(pageRunOf(scene)).toBe(run);
    expect(isPaged(scene)).toBe(true);
    expect(scene.get(run)!.layer).toBe('paper');
    expect(scene.get('a' as NodeId)!.layer).toBe('paper');
    expect(scene.get('a' as NodeId)!.parent).toBe(run);
  });

  it('answers no run on a scene without pages', () => {
    const scene = createScene({ systemLayers: [{ id: 'l' }] });
    expect(pageRunOf(scene)).toBeNull();
    expect(isPaged(scene)).toBe(false);
    expect(placedPagesOf(scene)).toEqual([]);
  });

  it('frames a page\'s children in the page', () => {
    const { child, worldX } = setup();
    expect(worldX(child)).toBe(115);
  });

  it('moves a page\'s children with it, leaving their stored poses, as one undo entry', () => {
    const { scene, child, worldX } = setup();
    movePage(scene, 'b', 0);
    expect(worldX(child)).toBe(5);
    expect(scene.get(child)!.pose.x).toBe(5);
    expect(placedPagesOf(scene).map((p) => p.id)).toEqual(['b', 'a']);
    scene.history.undo();
    expect(worldX(child)).toBe(115);
    expect(placedPagesOf(scene).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('shifts the pages after one that grows', () => {
    const { scene } = setup();
    resizePage(scene, 'a', { width: 200, height: 50 });
    expect(placedPagesOf(scene).map((p) => [p.id, p.x, p.width])).toEqual([['a', 0, 200], ['b', 210, 100]]);
  });

  it('removes a page with its subtree and what follows it', () => {
    const { scene, child } = setup();
    const onA = scene.add({
      kind: 'mark', layer: 'ink', parent: 'a' as NodeId, pose: { x: 1, y: 1, width: 1, height: 1 }, data: { n: 'onA' },
    });
    const link = scene.add({
      kind: 'mark', layer: 'ink', parent: pageRunOf(scene)!, pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { n: 'link' }, dependsOn: [onA, child],
    });
    removePage(scene, 'b');
    for (const id of ['b' as NodeId, child, link]) expect(scene.get(id)).toBeUndefined();
    expect(scene.get(onA)).toBeDefined();
    expect(placedPagesOf(scene).map((p) => p.id)).toEqual(['a']);
  });

  it('saves and loads as page nodes, laid out by the same run', () => {
    const { scene, child } = setup();
    const loaded = sceneFromJSON(JSON.parse(JSON.stringify(scene.toJSON())) as ReturnType<typeof scene.toJSON>);
    expect(loaded.get(pageRunOf(scene)!)!.pageRun).toEqual({ direction: 'row', gap: 10 });
    expect(loaded.get('b' as NodeId)!.page).toEqual({});
    resizePage(loaded, 'a', { width: 200, height: 50 });
    expect(placedPagesOf(loaded).map((p) => p.x)).toEqual([0, 210]);
    expect(loaded.get(child)!.parent).toBe('b');
  });

  it('finds the page a node is on, however deep', () => {
    const { scene, child } = setup();
    const grandchild = scene.add({
      kind: 'mark', layer: 'ink', parent: child, pose: { x: 0, y: 0, width: 1, height: 1 }, data: { n: 'g' },
    });
    expect(pageOfNode(scene, grandchild)).toBe('b');
    expect(pageOfNode(scene, 'a' as NodeId)).toBe('a');
    expect(pageOfNode(scene, pageRunOf(scene)!)).toBeNull();
  });
});

describe('a page whose id a node already holds', () => {
  function collided() {
    const scene = createScene<{ n: string }, 'paper' | 'ink', Pose>({ systemLayers: [{ id: 'paper' }, { id: 'ink' }] });
    scene.add({ id: 'b' as NodeId, kind: 'mark', layer: 'ink', pose: { x: 0, y: 0, width: 5, height: 5 }, data: { n: 'b' } });
    createPageRun(scene, [{ id: 'a', width: 100, height: 50 }, { id: 'b', width: 100, height: 50 }], { direction: 'row', gap: 10 });
    return { scene, page: pageNodeOf(scene, 'b')! };
  }

  it('gets a fresh node id and keeps its page id', () => {
    const { scene, page } = collided();
    expect(page).not.toBe('b');
    expect(scene.get(page)!.page).toEqual({ id: 'b' });
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['a', 'b']);
    expect(placedPagesOf(scene).map((p) => p.id)).toEqual(['a', 'b']);
    expect(pageNodeOf(scene, 'a')).toBe('a');
    expect(pageNodeOf(scene, 'nope')).toBeNull();
  });

  it('answers the page edits and the page reads by its page id', () => {
    const { scene, page } = collided();
    const on = scene.add({ kind: 'mark', layer: 'ink', parent: page, pose: { x: 1, y: 1, width: 5, height: 5 }, data: { n: 'on' } });
    expect(pageOfNode(scene, on)).toBe('b');
    expect(pageMembers(scene).get('b')).toEqual([on]);
    renamePage(scene, 'b', 'Back');
    resizePage(scene, 'b', { width: 200, height: 50 });
    movePage(scene, 'b', 0);
    expect(pagesOf(scene)!.pages.map((p) => [p.id, p.name, p.width])).toEqual([['b', 'Back', 200], ['a', undefined, 100]]);
    expect(scene.get(page)!.page).toEqual({ id: 'b', name: 'Back' });
    removePage(scene, 'b');
    expect(scene.get(page)).toBeUndefined();
    expect(scene.get(on)).toBeUndefined();
    expect(scene.get('b' as NodeId)!.data.n).toBe('b');
  });
});
