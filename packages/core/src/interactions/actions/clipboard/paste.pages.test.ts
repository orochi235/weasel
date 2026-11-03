/** A paste in a paged scene: the pasted roots go on the page under the paste's anchor. */
import { describe, expect, it } from 'vitest';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { ON_PAGE, PAGE_B, pagedScene } from 'core/pages/pagedFixture';
import { pageRunOf } from 'core/pages/pageNodes';
import { asNodeId, type RectPose } from 'core/scene/types';
import { materializePaste } from './materializePaste';

function paste(ids: string[], dropPoint: { x: number; y: number }, pasteboard = false) {
  const { scene } = pagedScene({ pasteboard });
  const adapter = sceneToAdapter(scene);
  const pasted = materializePaste(adapter as never, adapter.snapshotSelection(ids), { currentSelection: [], dropPoint })!;
  scene.applyBatch(pasted.ops, 'Paste', adapter as never);
  return { scene, nodes: pasted.newIds.map((id) => scene.get(asNodeId(id))!) };
}

describe('materializePaste in a paged scene', () => {
  it('puts a paste far from every page on the nearest one, with part of it on that page', () => {
    // Page b spans (110..210, 0..50); the pasted rect is 20 × 10.
    const { nodes: [node] } = paste([ON_PAGE], { x: 500, y: 300 });
    expect(node!.parent).toBe(PAGE_B);
    expect(node!.pose as RectPose).toMatchObject({ x: 99, y: 49 });
  });

  it('puts a paste on a page in that page, where it was dropped', () => {
    const { nodes: [node] } = paste([ON_PAGE], { x: 150, y: 20 });
    expect(node!.parent).toBe(PAGE_B);
    expect(node!.pose as RectPose).toMatchObject({ x: 40, y: 20 });
  });

  it('puts a paste off every page at the top of the tree with the pasteboard on', () => {
    const { nodes: [node] } = paste([ON_PAGE], { x: 500, y: 300 }, true);
    expect(node!.parent).toBeNull();
    expect(node!.pose as RectPose).toMatchObject({ x: 500, y: 300 });
  });

  it('puts a pasted follower in the page run', () => {
    const { scene } = pagedScene();
    const end = scene.add({ kind: 'mark', layer: 'ink', parent: asNodeId('b'), pose: { x: 10, y: 10, width: 5, height: 5 }, data: {} });
    const link = scene.add({
      kind: 'mark', layer: 'ink', parent: pageRunOf(scene)!, pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [ON_PAGE, end], derivePose: (_n, deps) => deps[0]?.pose ?? null,
    });
    const adapter = sceneToAdapter(scene);
    const pasted = materializePaste(adapter as never, adapter.snapshotSelection([ON_PAGE, end, link]), {
      currentSelection: [], dropPoint: { x: 20, y: 20 },
    })!;
    scene.applyBatch(pasted.ops, 'Paste', adapter as never);
    const copies = pasted.newIds.map((id) => scene.get(asNodeId(id))!);
    const follower = copies.find((n) => n.dependsOn !== undefined)!;
    expect(follower.parent).toBe(pageRunOf(scene));
    expect(copies.filter((n) => n !== follower).every((n) => n.parent === 'a')).toBe(true);
  });
});
