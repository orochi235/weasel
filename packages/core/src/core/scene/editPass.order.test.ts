/**
 * Edit passes run by ascending `order`, ties in the order they were added,
 * and each hears the edit's own changes plus what the passes before it wrote.
 */
import { describe, expect, it } from 'vitest';
import { createSetDataOp } from 'core/ops/setData';
import { createTransformOp as createSetPoseOp } from 'core/ops/transform';
import { createScene } from './scene';
import { asNodeId } from './types';
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

const ids = <T>(set: ReadonlySet<T>): T[] => [...set];

describe('scene edit pass order', () => {
  it('runs by ascending order, ties in the order added', () => {
    const { scene } = setup();
    const ran: string[] = [];
    const named = (name: string): SceneEditPass => () => { ran.push(name); return null; };
    scene.addEditPass(named('late'), { order: 5 });
    scene.addEditPass(named('first'), { order: -1 });
    scene.addEditPass(named('default'));
    scene.addEditPass(named('late too'), { order: 5 });
    scene.addEditPass(named('zero'), { order: 0 });
    scene.setPose(A, { ...POSE, x: 1 });
    expect(ran).toEqual(['first', 'default', 'zero', 'late', 'late too']);
  });

  it('lets a later pass hear an earlier pass’s setData, and not the reverse', () => {
    const { scene } = setup();
    const heard: Record<string, SceneEditSummary> = {};
    scene.addEditPass((s) => { heard.later = s; return null; }, { order: 10 });
    scene.addEditPass((s) => {
      heard.earlier = s;
      const b = scene.get(B)!;
      return [createSetDataOp({ id: B, from: b.data, to: { count: b.data.count + 1 } })];
    }, { order: 1 });
    scene.update(A, { data: { count: 3 } });
    expect(ids(heard.earlier!.dataChanged)).toEqual([A]);
    expect(ids(heard.later!.dataChanged)).toEqual([A, B]);
    expect(scene.historyEntries()).toHaveLength(1);
    scene.undo();
    expect(scene.get(B)!.data.count).toBe(0);
  });

  it('carries an earlier pass’s writes into an op batch’s later passes', () => {
    const { scene, adapter } = setup();
    let later: SceneEditSummary | null = null;
    scene.addEditPass(() => {
      const b = scene.get(B)!;
      return [createSetDataOp({ id: B, from: b.data, to: { count: 1 } })];
    });
    scene.addEditPass((s) => { later = s; return null; }, { order: 1 });
    scene.applyBatch([createSetPoseOp({ id: A, from: POSE, to: { ...POSE, x: 4 } })], 'Move', adapter);
    expect(ids(later!.posed)).toEqual([A]);
    expect(ids(later!.dataChanged)).toEqual([B]);
  });

  it('notes a document value set, by the edit or by a pass', () => {
    const { scene } = setup();
    const heard: SceneEditSummary[] = [];
    scene.addEditPass((s) => {
      heard.push(s);
      scene.doc.set('test:echo', scene.doc.get('test:value'));
      return null;
    });
    scene.addEditPass((s) => { heard.push(s); return null; }, { order: 1 });
    scene.doc.set('test:value', 7);
    expect(ids(heard[0]!.docChanged)).toEqual(['test:value']);
    expect(ids(heard[1]!.docChanged)).toEqual(['test:value', 'test:echo']);
    expect(heard).toHaveLength(2);
  });

  it('hands each pass a snapshot that later writes leave alone', () => {
    const { scene } = setup();
    let first: SceneEditSummary | null = null;
    scene.addEditPass((s) => {
      first = s;
      const b = scene.get(B)!;
      return [createSetDataOp({ id: B, from: b.data, to: { count: 2 } })];
    });
    scene.setPose(A, { ...POSE, x: 2 });
    expect(ids(first!.dataChanged)).toEqual([]);
  });
});
