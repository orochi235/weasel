import { describe, expect, it } from 'vitest';
import { PAGES_DOC_KEY, createScene, movePage, renamePage, type RectPose, type Scene } from '@weasel-js/core';
import { avoidSceneInput } from '../avoid/sceneInput';
import { installAvoidRouting } from '../avoid/install';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { createEdgeEnds } from '../edgeEndLayer';
import type { DiagramEdge } from '../edgeTrait';
import { sceneParticipants } from '../portLayer';
import { routeStateOf } from '../waypointLayer';
import { installOffPageMarkers } from './install';

type OffPageScene = Scene<unknown, 'main', RectPose>;

const LOOK = { style: { fontFamily: 'sans-serif', fontSize: 10 }, fill: '#111111', background: '#ffffff' };

// Two 200 by 100 pages, 40 apart: p1 spans x 0..200, p2 x 240..440.
const PAGES = { pages: [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }] };

const box = (id: string, x: number, y = 20) =>
  ({ id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x, y, width: 40, height: 30 }, data: { diagram: {} } });

const connector = (id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}) => ({
  id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {}, ...extra } },
  dependsOn: [from as never, to as never],
  derivePath: EDGE_DERIVE_PATH,
});

function load(extra: Partial<DiagramEdge> = {}, bAt = 120) {
  const scene: OffPageScene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    doc: { [PAGES_DOC_KEY]: PAGES },
    initial: [box('a', 20), box('b', bAt), connector('ab', 'a', 'b', extra)] as never,
  });
  const dispose = installOffPageMarkers(scene, { look: () => LOOK });
  return { scene, dispose };
}

const trait = (scene: OffPageScene, id = 'ab') => (scene.get(id as never)!.data as { diagram: DiagramEdge }).diagram;
const tagText = (scene: OffPageScene, end: 'from' | 'to') =>
  (scene.get(`ab/offpage-${end}` as never)?.data as { text?: string } | undefined)?.text;
const moveTo = (scene: OffPageScene, id: string, x: number) =>
  scene.setPose(id as never, { ...scene.get(id as never)!.pose, x });

describe('off-page markers in a scene', () => {
  it('splits a connector when a move takes one end to another page, in the move\'s entry, and undo joins it', () => {
    const { scene } = load();
    const depth = scene.historyEntries().length;
    moveTo(scene, 'b', 300);
    expect(trait(scene).offPage).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
    expect(tagText(scene, 'from')).toBe('Page 2 · A');
    expect(tagText(scene, 'to')).toBe('Page 1 · A');
    expect(scene.historyEntries().length).toBe(depth + 1);

    scene.undo();
    expect(trait(scene).offPage).toBeUndefined();
    expect(scene.get('ab/offpage-from' as never)).toBeUndefined();
    expect(scene.get('ab/offpage-to' as never)).toBeUndefined();
  });

  it('joins a split connector when its end comes back onto the other\'s page', () => {
    const { scene } = load();
    moveTo(scene, 'b', 300);
    moveTo(scene, 'b', 120);
    expect(trait(scene).offPage).toBeUndefined();
    expect(scene.get('ab/offpage-to' as never)).toBeUndefined();
  });

  it('leaves a connector whole while an end sits in the gap between pages', () => {
    const { scene } = load();
    scene.setPose('b' as never, { x: 205, y: 20, width: 30, height: 30 });
    expect(trait(scene).offPage).toBeUndefined();
  });

  it('keeps the ref through a page reorder, retexting the tags in the reorder\'s entry', () => {
    const { scene } = load();
    moveTo(scene, 'b', 300);
    const depth = scene.historyEntries().length;
    movePage(scene, 'p2', 0);
    expect(trait(scene).offPage).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
    expect(tagText(scene, 'from')).toBe('Page 1 · A');
    expect(tagText(scene, 'to')).toBe('Page 2 · A');
    expect(scene.historyEntries().length).toBe(depth + 1);
    scene.undo();
    expect(tagText(scene, 'from')).toBe('Page 2 · A');
  });

  it('retexts the tags naming a renamed page, and grows them to fit', () => {
    const { scene } = load();
    moveTo(scene, 'b', 300);
    const before = scene.get('ab/offpage-from' as never)!.pose.width;
    renamePage(scene, 'p2', 'Appendix');
    expect(tagText(scene, 'from')).toBe('Appendix · A');
    expect(scene.get('ab/offpage-from' as never)!.pose.width).toBeGreaterThan(before);
  });

  it('removes a connector\'s tags with a shape at its end', () => {
    const { scene } = load();
    moveTo(scene, 'b', 300);
    scene.remove('b' as never);
    expect(scene.get('ab/offpage-from' as never)).toBeUndefined();
    expect(scene.get('ab/offpage-to' as never)).toBeUndefined();
  });

  it('puts back a tag deleted on its own, since the connector is still split', () => {
    const { scene } = load();
    moveTo(scene, 'b', 300);
    scene.remove('ab/offpage-to' as never);
    expect(tagText(scene, 'to')).toBe('Page 1 · A');
  });

  it('recomputes nothing on install: a saved scene stands as it was saved', () => {
    const { scene } = load({}, 300);
    expect(trait(scene).offPage).toBeUndefined();
    expect(scene.get('ab/offpage-from' as never)).toBeUndefined();
  });

  it('stops installing on dispose', () => {
    const { scene, dispose } = load();
    dispose();
    moveTo(scene, 'b', 300);
    expect(trait(scene).offPage).toBeUndefined();
  });

  it('gives a split connector no route handles, and keeps its waypoints for when it joins', () => {
    const { scene } = load({ router: 'straight', waypoints: [{ x: 90, y: 80 }] });
    moveTo(scene, 'b', 300);
    const ends = createEdgeEnds(sceneParticipants<RectPose>(scene as never))('ab')!;
    expect(ends.route.stubs).toBeDefined();
    expect(routeStateOf(ends as never).handles).toEqual([]);
    expect(trait(scene).waypoints).toEqual([{ x: 90, y: 80 }]);
  });

  it('takes a split connector away from the avoid router, and routes it again in the entry that joins it', () => {
    const { scene } = load({ router: 'avoid' });
    installAvoidRouting(scene);
    moveTo(scene, 'b', 300);
    expect(avoidSceneInput(scene).edges.map((e) => e.id)).toEqual([]);
    scene.add(box('wall', 90, 0) as never);
    const depth = scene.historyEntries().length;
    moveTo(scene, 'b', 150);
    expect(trait(scene).offPage).toBeUndefined();
    expect(avoidSceneInput(scene).edges.map((e) => e.id)).toEqual(['ab']);
    expect(trait(scene).route?.length).toBeGreaterThan(0);
    expect(scene.historyEntries().length).toBe(depth + 1);
  });
});
