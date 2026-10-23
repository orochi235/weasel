/**
 * A scene edit pass hears each live edit — an op batch, a scene batch, a bare
 * call — once, and its ops land in that edit's undo entry. It never re-runs on
 * its own writes, and undo, redo, and history replay never run it.
 */
import { describe, expect, it, vi } from 'vitest';
import { createSetDataOp } from 'core/ops/setData';
import { createTransformOp as createSetPoseOp } from 'core/ops/transform';
import { createScene } from './scene';
import { asNodeId, type NodeId } from './types';
import type { SceneEditPass, SceneEditSummary } from './editPass';

type Pose = { x: number; y: number; width: number; height: number };
const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const A = asNodeId('a');
const B = asNodeId('b');

function setup() {
  const scene = createScene<{ count: number }, 'base', Pose>({ systemLayers: [{ id: 'base' }] });
  scene.add({ kind: 'mark', id: A, layer: 'base', pose: POSE, data: { count: 0 } });
  scene.add({ kind: 'mark', id: B, layer: 'base', pose: POSE, data: { count: 0 } });
  scene.history.clear();
  const adapter = {
    setPose: (id: string, pose: Pose) => scene.setPose(asNodeId(id), pose),
    setData: (id: string, data: { count: number }) => scene.update(asNodeId(id), { data }),
  };
  return { scene, adapter };
}

/** A pass that counts, on B, every edit that moved A. */
function countMovesOfA(scene: ReturnType<typeof setup>['scene']) {
  const heard: SceneEditSummary[] = [];
  const pass: SceneEditPass = (summary) => {
    heard.push(summary);
    if (!summary.posed.has(A)) return null;
    const b = scene.get(B)!;
    return [createSetDataOp({ id: B, from: b.data, to: { count: b.data.count + 1 } })];
  };
  return { heard, pass: vi.fn(pass) };
}

const moved = (x: number): Pose => ({ ...POSE, x });

describe('scene edit passes', () => {
  it('adds an op batch’s pass ops to the batch’s own entry', () => {
    const { scene, adapter } = setup();
    const { pass, heard } = countMovesOfA(scene);
    scene.addEditPass(pass);
    scene.applyBatch([createSetPoseOp({ id: A, from: POSE, to: moved(5) })], 'Move', adapter);
    expect(scene.get(B)!.data.count).toBe(1);
    expect(heard).toHaveLength(1);
    expect([...heard[0]!.posed]).toEqual([A]);
    expect(scene.historyEntries()).toHaveLength(1);
    scene.undo();
    expect(scene.get(A)!.pose).toEqual(POSE);
    expect(scene.get(B)!.data.count).toBe(0);
  });

  it('runs once per scene batch, after the batch’s own mutations', () => {
    const { scene } = setup();
    const { pass, heard } = countMovesOfA(scene);
    scene.addEditPass(pass);
    scene.batch('Two moves', () => {
      scene.setPose(A, moved(5));
      scene.setPose(A, moved(9));
      expect(pass).not.toHaveBeenCalled();
    });
    expect(heard).toHaveLength(1);
    expect(scene.get(B)!.data.count).toBe(1);
    expect(scene.historyEntries()).toHaveLength(1);
  });

  it('hears a bare call as an edit of its own', () => {
    const { scene } = setup();
    const { pass } = countMovesOfA(scene);
    scene.addEditPass(pass);
    scene.setPose(A, moved(5));
    expect(scene.get(B)!.data.count).toBe(1);
    expect(scene.historyEntries()).toHaveLength(1);
    scene.undo();
    expect(scene.get(B)!.data.count).toBe(0);
  });

  it('does not re-trigger on its own writes, nor on another pass’s, though a later pass hears them', () => {
    const { scene } = setup();
    const first = vi.fn<SceneEditPass>(() => [createSetPoseOp({ id: A, from: scene.get(A)!.pose, to: moved(50) })]);
    const second = vi.fn<SceneEditPass>(() => null);
    scene.addEditPass(first);
    scene.addEditPass(second);
    scene.update(B, { data: { count: 7 } });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect([...second.mock.calls[0]![0].posed]).toEqual([A]);
    expect([...first.mock.calls[0]![0].posed]).toEqual([]);
    expect([...second.mock.calls[0]![0].dataChanged]).toEqual([B]);
    expect(scene.get(A)!.pose).toEqual(moved(50));
  });

  it('is not run by undo, redo, or a jump through history', () => {
    const { scene } = setup();
    const { pass } = countMovesOfA(scene);
    scene.addEditPass(pass);
    scene.setPose(A, moved(5));
    scene.setPose(A, moved(9));
    expect(pass).toHaveBeenCalledTimes(2);
    scene.undo();
    scene.redo();
    scene.jumpToHistoryIndex(0);
    scene.jumpToHistoryIndex(2);
    expect(pass).toHaveBeenCalledTimes(2);
    expect(scene.get(B)!.data.count).toBe(2);
  });

  it('is not run by a history replayed from its serialized form', () => {
    const { scene } = setup();
    const { pass } = countMovesOfA(scene);
    scene.addEditPass(pass);
    scene.setPose(A, moved(5));
    scene.undo();
    const saved = scene.serializeHistory();
    scene.restoreHistory(saved);
    scene.redo();
    expect(pass).toHaveBeenCalledTimes(1);
    expect(scene.get(B)!.data.count).toBe(1);
  });

  it('summarizes adds, removes, and re-parents', () => {
    const { scene } = setup();
    const summaries: SceneEditSummary[] = [];
    scene.addEditPass((s) => { summaries.push(s); return null; });
    const box = asNodeId('box');
    scene.batch('Build', () => {
      scene.add({ kind: 'group', id: box, layer: 'base', pose: POSE, data: { count: 0 } });
      scene.move(A, box);
      scene.remove(B);
    });
    const [s] = summaries;
    const ids = (set: ReadonlySet<NodeId>) => [...set];
    expect(ids(s!.added)).toEqual([box]);
    expect(ids(s!.reparented)).toEqual([A]);
    expect(ids(s!.removed)).toEqual([B]);
  });

  it('stops hearing edits once removed, and leaves untracked edits alone', () => {
    const { scene } = setup();
    const { pass } = countMovesOfA(scene);
    const remove = scene.addEditPass(pass);
    scene.untracked(() => scene.setPose(A, moved(3)));
    expect(pass).not.toHaveBeenCalled();
    remove();
    scene.setPose(A, moved(5));
    expect(pass).not.toHaveBeenCalled();
  });
});
