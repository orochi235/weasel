/** A paste in a paged scene: the pasted roots go on the page under the paste's anchor. */
import { describe, expect, it } from 'vitest';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { ON_PAGE, PAGE_B, pagedScene } from 'core/pages/pagedFixture';
import { pageRunOf } from 'core/pages/pageNodes';
import { asNodeId, type RectPose } from 'core/scene/types';
import { materializePaste } from './materializePaste';

function paste(ids: string[], dropPoint: { x: number; y: number }, pasteboard = false, locked: string[] = []) {
  const { scene } = pagedScene({ pasteboard });
  for (const id of locked) scene.setLocked(asNodeId(id), true);
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

  it('puts a paste dropped on a locked page on the nearest page that is not', () => {
    const { nodes: [node] } = paste([ON_PAGE], { x: 150, y: 20 }, false, [PAGE_B]);
    expect(node!.parent).toBe('a');
    expect(node!.pose as RectPose).toMatchObject({ x: 99 });
  });

  it('puts a paste off every page at the top of the tree with the pasteboard on', () => {
    const { nodes: [node] } = paste([ON_PAGE], { x: 500, y: 300 }, true);
    expect(node!.parent).toBeNull();
    expect(node!.pose as RectPose).toMatchObject({ x: 500, y: 300 });
  });

  it('puts each of several pasted roots on the page under its own middle', () => {
    const { scene } = pagedScene();
    const r2 = scene.add({ kind: 'mark', layer: 'ink', parent: asNodeId('b'), pose: { x: 50, y: 10, width: 20, height: 10 }, data: {} });
    const adapter = sceneToAdapter(scene);
    // The two land at world 60..80 (page a) and 130..150 (page b).
    const pasted = materializePaste(adapter as never, adapter.snapshotSelection([ON_PAGE, r2]), {
      currentSelection: [], dropPoint: { x: 60, y: 10 },
    })!;
    scene.applyBatch(pasted.ops, 'Paste', adapter as never);
    const [first, second] = pasted.newIds.map((id) => scene.get(asNodeId(id))!);
    expect(first!.parent).toBe('a');
    expect(first!.pose as RectPose).toMatchObject({ x: 60, y: 10 });
    expect(second!.parent).toBe(PAGE_B);
    expect(second!.pose as RectPose).toMatchObject({ x: 20, y: 10 });
  });

  /** Paste `ON_PAGE`, `end` (on page b at `endX`) and a link following both, dropped at `drop`. */
  function pasteLink(endX: number, drop: { x: number; y: number }) {
    const { scene } = pagedScene();
    const end = scene.add({ kind: 'mark', layer: 'ink', parent: asNodeId('b'), pose: { x: endX, y: 10, width: 20, height: 10 }, data: {} });
    const link = scene.add({
      kind: 'mark', layer: 'ink', parent: pageRunOf(scene)!, pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [ON_PAGE, end], derivePose: (_n, deps) => deps[0]?.pose ?? null,
    });
    const adapter = sceneToAdapter(scene);
    const pasted = materializePaste(adapter as never, adapter.snapshotSelection([ON_PAGE, end, link]), {
      currentSelection: [], dropPoint: drop,
    })!;
    scene.applyBatch(pasted.ops, 'Paste', adapter as never);
    const copies = pasted.newIds.map((id) => scene.get(asNodeId(id))!);
    const follower = copies.find((n) => n.dependsOn !== undefined)!;
    return { scene, follower, ends: copies.filter((n) => n !== follower) };
  }

  it('puts a pasted follower on the page its pasted ends land on', () => {
    const { follower, ends } = pasteLink(10, { x: 20, y: 20 });
    expect(ends.map((n) => n.parent)).toEqual(['a', 'a']);
    expect(follower.parent).toBe('a');
  });

  it('puts a pasted follower whose ends land on two pages in the page run', () => {
    // The ends land at world 60..80 (page a) and 130..150 (page b).
    const { scene, follower, ends } = pasteLink(50, { x: 60, y: 10 });
    expect(ends.map((n) => n.parent)).toEqual(['a', PAGE_B]);
    expect(follower.parent).toBe(pageRunOf(scene));
  });

  /** Paste `ON_PAGE`, `end` and a link following both, with a tag following the link listed first, at `drop`. */
  function pasteChain(drop: { x: number; y: number }, ids: (link: string, tag: string) => string[]) {
    const { scene } = pagedScene();
    const end = scene.add({ kind: 'mark', layer: 'ink', parent: asNodeId('a'), pose: { x: 10, y: 30, width: 20, height: 10 }, data: {} });
    const link = scene.add({
      kind: 'mark', layer: 'ink', parent: asNodeId('a'), pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [ON_PAGE, end], derivePose: (_n, deps) => deps[0]?.pose ?? null,
    });
    const tag = scene.add({
      kind: 'mark', layer: 'ink', parent: asNodeId('a'), pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [link], derivePose: (_n, deps) => deps[0]?.pose ?? null,
    });
    const adapter = sceneToAdapter(scene);
    const pasted = materializePaste(adapter as never, adapter.snapshotSelection(ids(link, tag).map((id) => id === 'end' ? end : id)), {
      currentSelection: [], dropPoint: drop,
    })!;
    scene.applyBatch(pasted.ops, 'Paste', adapter as never);
    const copies = pasted.newIds.map((id) => scene.get(asNodeId(id))!);
    const copyOf = (original: string) => copies.find((n) => n.dependsOn?.length === (original === tag ? 1 : 2) && n.dependsOn !== undefined);
    return { scene, copies, link: copyOf(link)!, tag: copyOf(tag)! };
  }

  it('puts a pasted follower of a pasted follower on the page the pasted copy lands on, listed first or not', () => {
    // Everything lands on page b, while the originals stay on page a.
    for (const order of [(l: string, t: string) => [t, ON_PAGE, 'end', l], (l: string, t: string) => [ON_PAGE, 'end', l, t]]) {
      const { link, tag } = pasteChain({ x: 160, y: 20 }, order);
      expect(link.parent).toBe(PAGE_B);
      expect(tag.parent).toBe(PAGE_B);
      expect(tag.dependsOn).toEqual([link.id]);
    }
  });
});
