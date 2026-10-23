import { describe, expect, it } from 'vitest';
import { createScene } from '../scene/scene';
import { unionOfChildrenVia } from '../scene/unionOfChildren';
import { RECT_POSE_DESCRIPTOR } from '../geometry/poseDescriptor';
import type { NodeId } from '../scene/types';
import {
  PAGES_DOC_KEY, addPage, movePage, nextPageId, pageMembers, pagesOf, placedPagesOf, removePage, renamePage,
  resizePage, setPages, type PagesDoc,
} from './pageEdits';

type Pose = { x: number; y: number; width: number; height: number };

const TWO: PagesDoc = {
  pages: [{ id: 'a', width: 100, height: 100 }, { id: 'b', width: 100, height: 100, name: 'Second' }],
  layout: { gap: 20 },
};

function setup(doc: PagesDoc = TWO) {
  const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }], doc: { [PAGES_DOC_KEY]: doc } });
  const rect = (n: string, x: number, y: number, parent?: NodeId) => scene.add({
    kind: parent ? 'mark' : 'group', layer: 'l', pose: { x, y, width: 10, height: 10 }, data: { n },
    ...(parent ? { parent } : {}),
  });
  const onA = rect('onA', 10, 10);
  const child = rect('child', 12, 12, onA);
  const onB = rect('onB', 130, 50);
  const gap = rect('gap', 103, 50);
  const link = scene.add({
    kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 0, height: 0 }, data: { n: 'link' }, dependsOn: [onA, onB],
  });
  return { scene, onA, child, onB, gap, link, entries: () => scene.historyIndex() };
}

const x = (scene: ReturnType<typeof setup>['scene'], id: NodeId) => scene.get(id)!.pose.x;

describe('pages as a document value', () => {
  it('reads the pages doc and places it', () => {
    const { scene } = setup();
    expect(pagesOf(scene)).toEqual(TWO);
    expect(placedPagesOf(scene).map((p) => [p.id, p.x])).toEqual([['a', 0], ['b', 120]]);
    expect(pagesOf(createScene({ systemLayers: [{ id: 'l' }] }))).toBeNull();
  });

  it('names each page by its roots, leaving out gap nodes and nodes that derive from others', () => {
    const { scene, onA, onB } = setup();
    const members = pageMembers(scene, placedPagesOf(scene));
    expect(members.get('a')).toEqual([onA]);
    expect(members.get('b')).toEqual([onB]);
  });

  it('reorders pages and moves each one\'s members with it, descendants included, as one entry', () => {
    const { scene, onA, child, onB, gap, entries } = setup();
    const before = entries();
    movePage(scene, 'b', 0);
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['b', 'a']);
    expect(x(scene, onB)).toBe(10);
    expect(x(scene, onA)).toBe(130);
    expect(x(scene, child)).toBe(132);
    expect(x(scene, gap)).toBe(103);
    expect(entries()).toBe(before + 1);
    scene.undo();
    expect(pagesOf(scene)).toEqual(TWO);
    expect(x(scene, onA)).toBe(10);
    expect(x(scene, onB)).toBe(130);
  });

  it('moves the children of a group whose pose derives from them, and never writes the group', () => {
    const { scene } = setup();
    const group = scene.add({
      kind: 'group', layer: 'l', pose: { x: 0, y: 0, width: 0, height: 0 }, data: { n: 'group' },
      dependsOn: 'children', derivePose: unionOfChildrenVia(RECT_POSE_DESCRIPTOR),
    });
    const inner = scene.add({ kind: 'mark', layer: 'l', parent: group, pose: { x: 140, y: 20, width: 10, height: 10 }, data: { n: 'inner' } });
    movePage(scene, 'b', 0);
    expect(x(scene, inner)).toBe(20);
    expect(scene.get(group)!.pose.x).toBe(0);
  });

  it('resizes a page, keeping page-relative places and shifting the pages after it', () => {
    const { scene, onA, onB } = setup();
    resizePage(scene, 'a', { width: 200, height: 100 });
    expect(x(scene, onA)).toBe(10);
    expect(x(scene, onB)).toBe(230);
    expect(placedPagesOf(scene)[1]!.x).toBe(220);
  });

  it('removes a page with what is on it and every connector attached to that, as one entry', () => {
    const { scene, onA, child, onB, gap, link, entries } = setup();
    const before = entries();
    removePage(scene, 'a');
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['b']);
    for (const id of [onA, child, link]) expect(scene.get(id)).toBeUndefined();
    expect(x(scene, onB)).toBe(10);
    expect(x(scene, gap)).toBe(103);
    expect(entries()).toBe(before + 1);
    scene.undo();
    expect(scene.get(link)).toBeDefined();
    expect(x(scene, onB)).toBe(130);
  });

  it('adds and renames pages without moving anything', () => {
    const { scene, onB } = setup();
    addPage(scene, { id: nextPageId(pagesOf(scene)!.pages), width: 50, height: 50 }, { index: 0 });
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['page-1', 'a', 'b']);
    expect(x(scene, onB)).toBe(200);
    renamePage(scene, 'a', 'First');
    expect(pagesOf(scene)!.pages[1]!.name).toBe('First');
    expect(x(scene, onB)).toBe(200);
  });

  it('writes a first pages doc on a scene that had none, moving nothing', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    const id = scene.add({ kind: 'mark', layer: 'l', pose: { x: 5, y: 5, width: 1, height: 1 }, data: { n: '' } });
    setPages(scene, TWO, 'Pages');
    expect(pagesOf(scene)).toEqual(TWO);
    expect(scene.get(id)!.pose.x).toBe(5);
  });
});
