import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { createTransformOp } from '../ops/transform';
import type { LayoutStrategy } from '../../layout/types';
import { asNodeId, type NodeId, type RectPose } from './types';
import type { PoseRemoval, PoseWrite } from './poseWrites';

const at = (x: number, y = 0): RectPose => ({ x, y, width: 10, height: 10 });
const A = asNodeId('a');

function setup() {
  const scene = createScene<null, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    initial: [{ id: A, kind: 'leaf', layer: 'l', pose: at(0), data: null }],
  });
  const seen: PoseWrite<RectPose>[][] = [];
  const removed: PoseRemoval<RectPose>[][] = [];
  scene.onPoseWrite((w, r) => {
    if (w.length > 0) seen.push(w.map((x) => ({ ...x })));
    if (r.length > 0) removed.push([...r]);
  });
  return { scene, seen, removed };
}

describe('Scene.onPoseWrite', () => {
  it('reports a bare setPose as a call, with the pose it left', () => {
    const { scene, seen } = setup();
    scene.setPose(A, at(5));
    expect(seen).toEqual([[{ id: A, from: at(0), to: at(5), origin: 'call', label: 'setPose' }]]);
  });

  it('reports applyBatch as ops under its label, and a batch as a call under its own', () => {
    const { scene, seen } = setup();
    scene.applyBatch([createTransformOp<RectPose>({ id: A, from: at(0), to: at(7) })], 'Move', {
      setPose: (id: string, p: RectPose) => scene.setPose(asNodeId(id), p),
      getPose: (id: string) => scene.get(asNodeId(id))!.pose,
    });
    scene.batch('Arrange', () => { scene.setPose(A, at(8)); scene.setPose(A, at(9)); });
    expect(seen.map((ws) => ws.map((w) => [w.origin, w.label, w.from?.x, w.to.x]))).toEqual([
      [['ops', 'Move', 0, 7]],
      [['call', 'Arrange', 7, 9]],
    ]);
  });

  it('reports undo and redo with the direction they moved', () => {
    const { scene, seen } = setup();
    scene.setPose(A, at(5));
    seen.length = 0;
    scene.undo();
    scene.redo();
    expect(seen.map((ws) => ws.map((w) => [w.origin, w.label, w.from?.x, w.to.x]))).toEqual([
      [['undo', undefined, 5, 0]],
      [['redo', undefined, 0, 5]],
    ]);
  });

  it('reports untracked writes as untracked', () => {
    const { scene, seen } = setup();
    scene.untracked(() => scene.setPose(A, at(3)));
    expect(seen[0]?.[0]?.origin).toBe('untracked');
  });

  it('reports an added node with no from, and leaves out one written back or removed', () => {
    const { scene, seen, removed } = setup();
    const b = scene.add({ kind: 'leaf', layer: 'l', pose: at(20), data: null });
    scene.batch('there and back', () => { scene.setPose(A, at(4)); scene.setPose(A, at(0)); });
    scene.batch('come and go', () => {
      const c = scene.add({ kind: 'leaf', layer: 'l', pose: at(30), data: null });
      scene.remove(c);
    });
    expect(seen).toEqual([[{ id: b, from: undefined, to: at(20), origin: 'call', label: 'add leaf' }]]);
    expect(removed).toEqual([]);
  });

  it('reports a removed node as it was shown, with where it was and where the removal came from', () => {
    const { scene, seen, removed } = setup();
    scene.overrides.set(A, { pose: at(3) });
    scene.remove(A);
    expect(seen).toEqual([]);
    expect(removed).toHaveLength(1);
    expect(removed[0]![0]).toMatchObject({ id: A, parent: null, pose: at(3), origin: 'call', children: [] });
    expect(removed[0]![0]!.node).toMatchObject({ id: A, pose: at(0) });
  });

  it('reports a removed container once, carrying its descendants beneath it', () => {
    const scene = createScene<null, 'l', RectPose>({ systemLayers: [{ id: 'l' }] });
    const g = scene.add({ kind: 'container', layer: 'l', pose: at(0), data: null });
    const k = scene.add({ kind: 'leaf', layer: 'l', parent: g, pose: at(4), data: null });
    const removed: PoseRemoval<RectPose>[] = [];
    scene.onPoseWrite((_w, r) => removed.push(...r));
    scene.remove(g);
    expect(removed.map((r) => r.id)).toEqual([g]);
    expect(removed[0]!.children.map((c) => [c.node, c.pose])).toEqual([[expect.objectContaining({ id: k }), at(4)]]);
  });

  it('reports an undone add as a removal by the undo, its children beneath it', () => {
    const scene = createScene<null, 'l', RectPose>({ systemLayers: [{ id: 'l' }] });
    let g!: NodeId;
    scene.batch('make', () => {
      g = scene.add({ kind: 'container', layer: 'l', pose: at(0), data: null });
      scene.add({ kind: 'leaf', layer: 'l', parent: g, pose: at(4), data: null });
    });
    const removed: PoseRemoval<RectPose>[] = [];
    scene.onPoseWrite((_w, r) => removed.push(...r));
    scene.undo();
    expect(removed.map((r) => [r.id, r.origin, r.children.length])).toEqual([[g, 'undo', 1]]);
  });

  it('reports a node removed and put back within one change as moved, not removed', () => {
    const { scene, seen, removed } = setup();
    scene.batch('swap', () => {
      scene.remove(A);
      scene.add({ id: A, kind: 'leaf', layer: 'l', pose: at(6), data: null });
    });
    expect(removed).toEqual([]);
    expect(seen).toEqual([[expect.objectContaining({ id: A, from: at(0), to: at(6) })]]);
  });

  it('reports a node an undo brings back as added', () => {
    const { scene, seen } = setup();
    scene.remove(A);
    expect(seen).toEqual([]);
    scene.undo();
    expect(seen).toEqual([[{ id: A, from: undefined, to: at(0), origin: 'undo' }]]);
  });

  it("reports a layout's arranging as layout", () => {
    const stack: LayoutStrategy<RectPose> = {
      snap: { pickTarget: () => null },
      // Newest first, so each arrival pushes the others down.
      childPoses: (c, children) => new Map(children.map((ch, i) => [ch.id, { ...c.bounds, y: (children.length - 1 - i) * 5, height: 5 }])),
      getDropTargets: () => [],
      reflowPoses: () => new Map(),
      commitDrop: () => [],
    };
    const C = asNodeId('C');
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      initial: [{ id: C, kind: 'container', layer: 'l', pose: { x: 0, y: 0, width: 9, height: 90 }, data: null, layout: stack }],
    });
    const k = scene.add({ kind: 'leaf', layer: 'l', parent: C, pose: at(50, 50), data: null });
    const seen: PoseWrite<RectPose>[] = [];
    scene.onPoseWrite((w) => seen.push(...w));
    scene.add({ kind: 'leaf', layer: 'l', parent: C, pose: at(50, 50), data: null });
    expect(seen.find((w) => w.id === k)).toMatchObject({ from: { y: 0 }, to: { y: 5 }, origin: 'layout' });
  });

  it('does not report loadState or the initial nodes', () => {
    const { scene, seen } = setup();
    scene.loadState(scene.toJSON());
    expect(seen).toEqual([]);
  });

  it('reports before the scene notifies its subscribers, and stops when unsubscribed', () => {
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      initial: [{ id: A, kind: 'leaf', layer: 'l', pose: at(0), data: null }],
    });
    const order: string[] = [];
    scene.subscribe(() => order.push('notify'));
    const off = scene.onPoseWrite(() => order.push('write'));
    scene.setPose(A, at(1));
    off();
    scene.setPose(A, at(2));
    expect(order).toEqual(['write', 'notify', 'notify']);
  });
});
