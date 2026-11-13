import { describe, expect, it } from 'vitest';
import { createScene } from '../scene/scene';
import { composeWorldPose } from '../scene/composePose';
import { scenePoseAdapter } from '../scene/scenePoseAdapter';
import { unionOfChildrenVia } from '../scene/unionOfChildren';
import { RECT_POSE_DESCRIPTOR } from '../geometry/poseDescriptor';
import type { NodeId } from '../scene/types';
import {
  addPage, movePage, nextPageId, pageMembers, pagesOf, placedPagesOf, removePage, renamePage,
  resizePage, setPages, type PagesDoc,
} from './pageEdits';
import { createPageRun, pageRunOf } from './pageNodes';

type Pose = { x: number; y: number; width: number; height: number };

const TWO: PagesDoc = {
  pages: [{ id: 'a', width: 100, height: 100 }, { id: 'b', width: 100, height: 100, name: 'Second' }],
  layout: { gap: 20 },
};

function setup(doc: PagesDoc = TWO) {
  const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
  createPageRun(scene, doc.pages, doc.layout);
  const rect = (n: string, x: number, y: number, parent: string | null) => scene.add({
    kind: 'mark', layer: 'l', pose: { x, y, width: 10, height: 10 }, data: { n },
    ...(parent ? { parent: parent as NodeId } : {}),
  });
  const onA = rect('onA', 10, 10, 'a');
  const child = rect('child', 2, 2, onA);
  const onB = rect('onB', 10, 50, 'b');
  const gap = rect('gap', 103, 50, null);
  const link = scene.add({
    kind: 'mark', layer: 'l', parent: pageRunOf(scene)!, pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { n: 'link' }, dependsOn: [onA, onB],
  });
  return { scene, onA, child, onB, gap, link, entries: () => scene.historyIndex() };
}

type S = ReturnType<typeof setup>['scene'];
const worldX = (scene: S, id: NodeId) =>
  (composeWorldPose(scenePoseAdapter(scene as never), id, scene.composition.compose as never) as Pose).x;
const storedX = (scene: S, id: NodeId) => scene.get(id)!.pose.x;

describe('page edits', () => {
  it('reads the pages off the nodes and places them', () => {
    const { scene } = setup();
    expect(pagesOf(scene)).toEqual(TWO);
    expect(placedPagesOf(scene).map((p) => [p.id, p.x])).toEqual([['a', 0], ['b', 120]]);
    expect(pagesOf(createScene({ systemLayers: [{ id: 'l' }] }))).toBeNull();
  });

  it('names what is on each page: its children', () => {
    const { scene, onA, onB } = setup();
    const members = pageMembers(scene, placedPagesOf(scene));
    expect(members.get('a')).toEqual([onA]);
    expect(members.get('b')).toEqual([onB]);
  });

  it('reorders pages and carries what is on each, without rewriting it, as one entry', () => {
    const { scene, onA, child, onB, gap, entries } = setup();
    const before = entries();
    movePage(scene, 'b', 0);
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['b', 'a']);
    expect(worldX(scene, onB)).toBe(10);
    expect(worldX(scene, onA)).toBe(130);
    expect(worldX(scene, child)).toBe(132);
    for (const id of [onA, child, onB]) expect(storedX(scene, id)).toBe(id === child ? 2 : 10);
    expect(worldX(scene, gap)).toBe(103);
    expect(entries()).toBe(before + 1);
    scene.undo();
    expect(pagesOf(scene)).toEqual(TWO);
    expect(worldX(scene, onA)).toBe(10);
    expect(worldX(scene, onB)).toBe(130);
  });

  it('carries a group whose pose derives from its children, and never writes it', () => {
    const { scene } = setup();
    const group = scene.add({
      kind: 'group', layer: 'l', parent: 'b' as NodeId, pose: { x: 0, y: 0, width: 0, height: 0 }, data: { n: 'group' },
      dependsOn: 'children', derivePose: unionOfChildrenVia(RECT_POSE_DESCRIPTOR),
    });
    const inner = scene.add({ kind: 'mark', layer: 'l', parent: group, pose: { x: 20, y: 20, width: 10, height: 10 }, data: { n: 'inner' } });
    expect(worldX(scene, inner)).toBe(140);
    movePage(scene, 'b', 0);
    expect(worldX(scene, inner)).toBe(20);
    expect(storedX(scene, inner)).toBe(20);
    expect(scene.get(group)!.pose.x).toBe(0);
  });

  it('resizes a page, keeping what is on it in place and shifting the pages after it', () => {
    const { scene, onA, onB } = setup();
    resizePage(scene, 'a', { width: 200, height: 100 });
    expect(worldX(scene, onA)).toBe(10);
    expect(worldX(scene, onB)).toBe(230);
    expect(placedPagesOf(scene)[1]!.x).toBe(220);
  });

  it('removes a page with what is on it and every connector attached to that, as one entry', () => {
    const { scene, onA, child, onB, gap, link, entries } = setup();
    const before = entries();
    removePage(scene, 'a');
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['b']);
    for (const id of ['a' as NodeId, onA, child, link]) expect(scene.get(id)).toBeUndefined();
    expect(worldX(scene, onB)).toBe(10);
    expect(worldX(scene, gap)).toBe(103);
    expect(entries()).toBe(before + 1);
    scene.undo();
    expect(scene.get(link)).toBeDefined();
    expect(worldX(scene, onB)).toBe(130);
    expect(pagesOf(scene)).toEqual(TWO);
  });

  it('adds and renames pages, moving only the pages after an added one', () => {
    const { scene, onB } = setup();
    addPage(scene, { id: nextPageId(pagesOf(scene)!.pages), width: 50, height: 50 }, { index: 0 });
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['page-1', 'a', 'b']);
    expect(worldX(scene, onB)).toBe(200);
    renamePage(scene, 'a', 'First');
    expect(pagesOf(scene)!.pages[1]!.name).toBe('First');
    expect(worldX(scene, onB)).toBe(200);
  });

  it('carries a page\'s meta through every edit, and undo restores it', () => {
    const meta = { 'owner:key': { kept: true } };
    const { scene } = setup({ pages: [{ id: 'a', width: 100, height: 100, meta }, TWO.pages[1]!], layout: { gap: 20 } });
    const metaOfA = () => pagesOf(scene)!.pages.find((p) => p.id === 'a')!.meta;
    movePage(scene, 'a', 1);
    resizePage(scene, 'a', { width: 150, height: 100 });
    renamePage(scene, 'a', 'First');
    addPage(scene, { id: 'c', width: 50, height: 50 });
    removePage(scene, 'b');
    expect(metaOfA()).toEqual(meta);
    expect(placedPagesOf(scene).find((p) => p.id === 'a')!.meta).toEqual(meta);
    renamePage(scene, 'a', '');
    expect(metaOfA()).toEqual(meta);
    scene.undo();
    expect(metaOfA()).toEqual(meta);
  });

  it('makes a scene with no pages paged, moving nothing', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    const id = scene.add({ kind: 'mark', layer: 'l', pose: { x: 5, y: 5, width: 1, height: 1 }, data: { n: '' } });
    setPages(scene, TWO, { label: 'Pages' });
    expect(pagesOf(scene)).toEqual(TWO);
    expect(placedPagesOf(scene).map((p) => p.x)).toEqual([0, 120]);
    expect(scene.get(id)!.pose.x).toBe(5);
  });

  it('lays the pages out again when only the run\'s settings change', () => {
    const { scene } = setup({ pages: [{ id: 'a', width: 100, height: 100 }, { id: 'b', width: 100, height: 40 }], layout: { gap: 20 } });
    setPages(scene, { ...pagesOf(scene)!, layout: { gap: 20, align: 'center' } }, { label: 'Align' });
    expect(placedPagesOf(scene).map((p) => [p.id, p.y])).toEqual([['a', 0], ['b', 30]]);
    scene.undo();
    expect(placedPagesOf(scene).map((p) => p.y)).toEqual([0, 0]);
  });

  it('places pages as the edit makes them, inside a caller\'s batch', () => {
    const { scene } = setup();
    scene.batch('Open', () => {
      resizePage(scene, 'a', { width: 200, height: 100 });
      expect(placedPagesOf(scene)[1]!.x).toBe(220);
    });
  });

  it('starts the run at its origin', () => {
    const { scene } = setup({ ...TWO, layout: { gap: 20, origin: { x: 50, y: 7 } } });
    expect(placedPagesOf(scene).map((p) => [p.x, p.y])).toEqual([[50, 7], [170, 7]]);
    expect(pagesOf(scene)!.layout).toEqual({ gap: 20, origin: { x: 50, y: 7 } });
  });
});

describe('making a Continuous scene paged', () => {
  it('puts every content root on a page, as one undo entry with the pages', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    const near = scene.add({ kind: 'mark', layer: 'l', pose: { x: 10, y: 10, width: 10, height: 10 }, data: { n: 'near' } });
    const far = scene.add({ kind: 'mark', layer: 'l', pose: { x: 900, y: 10, width: 10, height: 10 }, data: { n: 'far' } });
    addPage(scene, { id: 'p', width: 100, height: 100 });
    expect(scene.roots).toEqual([pageRunOf(scene)]);
    expect([scene.get(near)!.parent, scene.get(far)!.parent]).toEqual(['p', 'p']);
    expect(scene.get(far)!.pose).toMatchObject({ x: 99 });
    scene.undo();
    expect(scene.roots).toEqual([near, far]);
    expect(scene.get(far)!.pose).toMatchObject({ x: 900 });
  });

  it('leaves a scene with no pages as it is, with no undo entry, on an edit that adds none', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    const r = scene.add({ kind: 'mark', layer: 'l', pose: { x: 900, y: 10, width: 10, height: 10 }, data: { n: 'r' } });
    const entries = scene.historyIndex();
    renamePage(scene, 'a', 'A');
    movePage(scene, 'a', 1);
    resizePage(scene, 'a', { width: 10, height: 10 });
    removePage(scene, 'a');
    expect(pagesOf(scene)).toBeNull();
    expect(scene.roots).toEqual([r]);
    expect(scene.historyIndex()).toBe(entries);
  });

  it('measures the content by the descriptor the page edit is given', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    const r = scene.add({ kind: 'mark', layer: 'l', pose: { x: 120, y: 10, width: 10, height: 10 }, data: { n: 'r' } });
    // Reads every box 100 to the left, so `r` measures as on page a and is not shifted onto it.
    const shifted = { ...RECT_POSE_DESCRIPTOR, getBounds: (p: Pose) => ({ ...p, x: p.x - 100 }) };
    addPage(scene, { id: 'a', width: 100, height: 100 }, { descriptor: shifted as never });
    expect(scene.get(r)!).toMatchObject({ parent: 'a', pose: { x: 120 } });
  });
});
