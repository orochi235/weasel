import { describe, expect, it } from 'vitest';
import { createScene, createTransformOp, derivedDepOf, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import type { DiagramEdge } from '../edgeTrait';
import { installHops } from './install';
import { HOPS_DOC_KEY } from './types';

type HopScene = Scene<unknown, 'main', RectPose>;

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

const connector = (id: string, from: string, to: string) => ({
  id: id as never,
  kind: 'leaf' as const,
  layer: 'main' as const,
  pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {} } },
  dependsOn: [from as never, to as never],
  derivePath: EDGE_DERIVE_PATH,
});

/** `ab` runs along y = 30 from x = 100 to 400; `cd` runs down x = 250 from y = -140 to 200, drawn after it. */
function load(on = true) {
  const scene: HopScene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    initial: [
      box('a', 0, 0), box('b', 400, 0), box('c', 200, -200), box('d', 200, 200),
      connector('ab', 'a', 'b'), connector('cd', 'c', 'd'),
    ] as never,
    ...(on ? { doc: { [HOPS_DOC_KEY]: { size: 5 } } } : {}),
  });
  const hops = installHops(scene);
  const adapter = { setPose: (id: string, pose: RectPose) => scene.setPose(id as never, pose) };
  const move = (id: string, x: number, y: number) => {
    const from = scene.get(id as never)!.pose;
    scene.applyBatch([createTransformOp({ id, from, to: { ...from, x, y } })], 'Move', adapter);
  };
  return { scene, hops, move };
}

const hopsOf = (scene: HopScene, id: string) => (scene.get(id as never)!.data as { diagram: DiagramEdge }).diagram.hops;

describe('line jumps in a scene', () => {
  it('writes nothing on install, and turning them on hops the upper connector in that one entry', () => {
    const { scene } = load(false);
    expect(hopsOf(scene, 'cd')).toBeUndefined();
    const depth = scene.historyEntries().length;
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    expect(hopsOf(scene, 'cd')).toEqual([{ at: { x: 250, y: 30 }, over: ['ab'], r: 5 }]);
    expect(hopsOf(scene, 'ab')).toBeUndefined();
    expect(scene.historyEntries().length).toBe(depth + 1);
    scene.undo();
    expect(hopsOf(scene, 'cd')).toBeUndefined();
    expect(scene.doc.get(HOPS_DOC_KEY)).toBeUndefined();
  });

  it('draws the hop into the upper connector\'s path', () => {
    const { scene } = load(false);
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    const path = derivedDepOf(scene, 'cd' as never)?.path as { commands: Uint8Array } | null;
    expect([...path!.commands]).toContain(2);
  });

  it('removes a hop when a move ends the crossing, and makes one when a move starts it, each in the move\'s entry', () => {
    const { scene, move } = load(false);
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    const depth = scene.historyEntries().length;
    move('c', 600, -200);
    move('d', 600, 200);
    expect(hopsOf(scene, 'cd')).toBeUndefined();
    expect(scene.historyEntries().length).toBe(depth + 2);
    move('c', 220, -200);
    move('d', 220, 200);
    expect(hopsOf(scene, 'cd')).toEqual([{ at: { x: 270, y: 30 }, over: ['ab'], r: 5 }]);
    scene.undo();
    expect(hopsOf(scene, 'cd')).toBeUndefined();
  });

  it('moves a hop when the connector it passes over moves', () => {
    const { scene, move } = load();
    scene.doc.set(HOPS_DOC_KEY, { size: 6 });
    move('a', 0, 40);
    move('b', 400, 40);
    expect(hopsOf(scene, 'cd')).toEqual([{ at: { x: 250, y: 70 }, over: ['ab'], r: 6 }]);
  });

  it('clears every hop in the one entry that turns them off', () => {
    const { scene } = load(false);
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    const depth = scene.historyEntries().length;
    scene.doc.set(HOPS_DOC_KEY, undefined);
    expect(hopsOf(scene, 'cd')).toBeUndefined();
    expect(scene.historyEntries().length).toBe(depth + 1);
    scene.undo();
    expect(hopsOf(scene, 'cd')).toEqual([{ at: { x: 250, y: 30 }, over: ['ab'], r: 5 }]);
  });

  it('hops the other connector once render order puts it on top', () => {
    const { scene } = load(false);
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    scene.reorder('ab' as never, 5);
    expect(hopsOf(scene, 'cd')).toBeUndefined();
    expect(hopsOf(scene, 'ab')).toEqual([{ at: { x: 250, y: 30 }, over: ['cd'], r: 5 }]);
  });

  it('writes nothing while off', () => {
    const { scene, move } = load(false);
    move('c', 220, -200);
    expect(hopsOf(scene, 'cd')).toBeUndefined();
  });

  it('previews a drag with hops gone from the moved connectors and every connector hopping over one', () => {
    const { scene, hops } = load(false);
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    const frame = new Map([['a', { x: 0, y: 10, width: 100, height: 60 }]]);
    const preview = hops.follower.preview(frame, new Map());
    expect(preview.map((p) => p.id)).toEqual(['cd']);
    expect((preview[0]!.data as { diagram: DiagramEdge }).diagram.hops).toBeUndefined();
    expect(hopsOf(scene, 'cd')).toHaveLength(1);
  });

  it('keeps what an earlier follower previewed for a connector, without its hops', () => {
    const { scene, hops } = load(false);
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    const routed = { ...(scene.get('cd' as never)!.data as object), routedBy: 'earlier' };
    const preview = hops.follower.preview(new Map([['c', { x: 210, y: -200, width: 100, height: 60 }]]), new Map([['cd', routed]]));
    expect(preview[0]!.data).toMatchObject({ routedBy: 'earlier' });
    expect((preview[0]!.data as { diagram: DiagramEdge }).diagram.hops).toBeUndefined();
  });

  it('leaves a connector split across pages out: it neither hops nor is hopped over, and splitting clears its hops', () => {
    const { scene } = load(false);
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    expect(hopsOf(scene, 'cd')).toHaveLength(1);
    const split = (id: string) => {
      const node = scene.get(id as never)!;
      const data = node.data as { diagram: DiagramEdge };
      scene.update(id as never, { data: { ...data, diagram: { ...data.diagram, offPage: { ref: 'A', from: 'p1', to: 'p2' } } } as never });
    };
    split('cd');
    expect(hopsOf(scene, 'cd')).toBeUndefined();
    expect(hopsOf(scene, 'ab')).toBeUndefined();
    scene.undo();
    expect(hopsOf(scene, 'cd')).toHaveLength(1);
    split('ab');
    expect(hopsOf(scene, 'cd')).toBeUndefined();
  });
});
