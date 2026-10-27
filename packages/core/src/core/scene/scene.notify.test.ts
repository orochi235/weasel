import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import type { NodeId, RectPose } from './types';
import type { Op } from 'core/ops/types';
import type { LayoutStrategy } from '../../layout/types';

const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const at = (x: number): RectPose => ({ ...POSE, x });
const A = asNodeId('a');
const B = asNodeId('b');
const C = asNodeId('C');

function makeScene(options: { coalesceWindowMs?: number } = {}) {
  const scene = createScene<null, 'l' | 'm', RectPose>({ systemLayers: [{ id: 'l' }, { id: 'm' }], ...options });
  scene.add({ id: A, kind: 'mark', layer: 'l', pose: POSE, data: null });
  scene.add({ id: B, kind: 'mark', layer: 'l', pose: POSE, data: null });
  return scene;
}

/** How many times subscribers were called, and how far the version moved, while `fn` ran. */
function heard(scene: { subscribe(l: () => void): () => void; getVersion(): number }, fn: () => void) {
  let calls = 0;
  const off = scene.subscribe(() => { calls++; });
  const before = scene.getVersion();
  try {
    fn();
  } finally {
    off();
  }
  return { calls, version: scene.getVersion() - before };
}

/** An op that writes poses through the scene, the way an adapter-driven one does. */
function poseOp(scene: ReturnType<typeof makeScene>, writes: [NodeId, number, number][]): Op {
  const make = (forward: boolean): Op => ({
    apply: () => { for (const [id, from, to] of writes) scene.setPose(id, at(forward ? to : from)); },
    invert: () => make(!forward),
  });
  return make(true);
}

describe('Scene — what subscribers hear', () => {
  it('a bare edit calls once and moves the version by one', () => {
    const scene = makeScene();
    expect(heard(scene, () => scene.setPose(A, at(1)))).toEqual({ calls: 1, version: 1 });
  });

  it('a batch calls once, after its entry is on the stack, and counts every write', () => {
    const scene = makeScene();
    const depth = scene.historyIndex();
    let depthHeard = -1;
    scene.subscribe(() => { depthHeard = scene.historyIndex(); });
    const out = heard(scene, () => scene.batch('edit', () => {
      scene.setPose(A, at(1));
      scene.batch('inner', () => scene.setPose(B, at(2)));
      scene.setSelection([A]);
    }));
    expect(out).toEqual({ calls: 1, version: 3 });
    expect(depthHeard).toBe(depth + 1);
  });

  it('a batch that changes nothing calls nobody', () => {
    const scene = makeScene();
    expect(heard(scene, () => scene.batch('nothing', () => {}))).toEqual({ calls: 0, version: 0 });
  });

  it('a batch that throws calls once, for the revert', () => {
    const scene = makeScene();
    const out = heard(scene, () => {
      expect(() => scene.batch('edit', () => {
        scene.setPose(A, at(1));
        throw new Error('boom');
      })).toThrow('boom');
    });
    expect(out).toEqual({ calls: 1, version: 2 });
    expect(scene.get(A)!.pose).toEqual(POSE);
  });

  it('untracked calls once and counts every write', () => {
    const scene = makeScene();
    const out = heard(scene, () => scene.untracked(() => {
      scene.setPose(A, at(1));
      scene.setPose(B, at(2));
    }));
    expect(out).toEqual({ calls: 1, version: 2 });
  });

  it('undo and redo of a two-write entry each call once', () => {
    const scene = makeScene();
    scene.batch('edit', () => {
      scene.setPose(A, at(1));
      scene.setPose(B, at(2));
    });
    expect(heard(scene, () => scene.undo())).toEqual({ calls: 1, version: 2 });
    expect(heard(scene, () => scene.redo())).toEqual({ calls: 1, version: 2 });
    expect(heard(scene, () => scene.jumpToHistoryIndex(0))).toEqual({ calls: 1, version: 4 });
  });

  it('an engine step leaves nothing pending for the next edit to flush', () => {
    const scene = makeScene();
    scene.setPose(A, at(1));
    scene.undo();
    scene.history.applyOps([poseOp(scene, [[A, 0, 1]])], 'move');
    expect(heard(scene, () => scene.batch('nothing', () => {}))).toEqual({ calls: 0, version: 0 });
    expect(heard(scene, () => scene.untracked(() => {}))).toEqual({ calls: 0, version: 0 });
  });

  it('an undo with nothing to undo calls nobody', () => {
    const scene = createScene<null, 'l', RectPose>({ systemLayers: [{ id: 'l' }] });
    expect(heard(scene, () => scene.undo())).toEqual({ calls: 0, version: 0 });
  });

  it('applyBatch calls once and adds no write of its own', () => {
    const scene = makeScene();
    const out = heard(scene, () => scene.applyBatch([poseOp(scene, [[A, 0, 1], [B, 0, 2]])], 'move', null));
    expect(out).toEqual({ calls: 1, version: 2 });
  });

  it('applyBatch inside a batch leaves the one call to the batch', () => {
    const scene = makeScene();
    const out = heard(scene, () => scene.batch('outer', () => {
      scene.setPose(A, at(1));
      scene.applyBatch([poseOp(scene, [[B, 0, 2]])], 'inner', null);
    }));
    expect(out).toEqual({ calls: 1, version: 2 });
  });

  it('history.applyOps calls once, with one write of its own', () => {
    const scene = makeScene();
    const out = heard(scene, () => scene.history.applyOps([poseOp(scene, [[A, 0, 1], [B, 0, 2]])], 'move'));
    expect(out).toEqual({ calls: 1, version: 3 });
  });

  it('a selection change calls once and moves the version', () => {
    const scene = makeScene();
    expect(heard(scene, () => scene.setSelection([A]))).toEqual({ calls: 1, version: 1 });
  });

  it('removing a selected node is one call and one write: narrowing the selection is not a second', () => {
    const scene = makeScene();
    scene.setSelection([A, B]);
    expect(heard(scene, () => scene.remove(A))).toEqual({ calls: 1, version: 1 });
    expect(scene.getSelection()).toEqual([B]);
  });

  it('locking a layer is one call and one write, whatever it takes out of the selection', () => {
    const scene = makeScene();
    scene.setSelection([A]);
    expect(heard(scene, () => scene.setLayerLocked('l', true))).toEqual({ calls: 1, version: 1 });
    expect(scene.getSelection()).toEqual([]);
  });

  it('loadState calls once', () => {
    const scene = makeScene();
    const json = scene.toJSON();
    expect(heard(scene, () => scene.loadState(json))).toEqual({ calls: 1, version: 1 });
  });

  it('restoreHistory and history.clear each call once', () => {
    const scene = makeScene();
    const snapshot = scene.serializeHistory();
    expect(heard(scene, () => scene.restoreHistory(snapshot))).toEqual({ calls: 1, version: 1 });
    expect(heard(scene, () => scene.history.clear())).toEqual({ calls: 1, version: 1 });
  });
});

describe('Scene — the selection around a refused edit', () => {
  it('a batch that throws puts back the very selection it opened under', () => {
    const scene = makeScene();
    scene.setSelection([A]);
    const before = scene.getSelection();
    expect(() => scene.batch('edit', () => {
      scene.setSelection([B]);
      scene.remove(A);
      throw new Error('boom');
    })).toThrow('boom');
    expect(scene.getSelection()).toBe(before);
  });

  it('a selection made inside untracked survives it', () => {
    const scene = makeScene();
    scene.untracked(() => scene.setSelection([B]));
    expect(scene.getSelection()).toEqual([B]);
  });

  it('an undo restores the selection less whatever a lock has since put out of reach', () => {
    const scene = makeScene();
    scene.add({ id: asNodeId('m1'), kind: 'mark', layer: 'm', pose: POSE, data: null });
    scene.setSelection([A, asNodeId('m1')]);
    scene.setPose(A, at(1));
    scene.setSelection([]);
    scene.untracked(() => scene.setLayerLocked('m', true));
    scene.undo();
    expect(scene.getSelection()).toEqual([A]);
  });

  it('loadState keeps the selected ids the snapshot still holds', () => {
    const scene = makeScene();
    const json = scene.toJSON();
    scene.add({ id: asNodeId('z'), kind: 'mark', layer: 'l', pose: POSE, data: null });
    scene.setSelection([A, asNodeId('z')]);
    scene.loadState(json);
    expect(scene.getSelection()).toEqual([A]);
  });
});

function stack(): LayoutStrategy<RectPose> {
  return {
    snap: { pickTarget: () => null },
    childPoses: (container, children) => new Map(children.map((c, i) => [c.id, {
      x: container.bounds.x, y: container.bounds.y + i * 10, width: container.bounds.width, height: 10,
    }])),
    getDropTargets: () => [],
    reflowPoses: () => new Map(),
    commitDrop: () => [],
  };
}

function makeLaidOut(options: { coalesceWindowMs?: number } = {}) {
  const scene = createScene<null, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    initial: [{ id: C, kind: 'group', layer: 'l', pose: { x: 100, y: 100, width: 50, height: 200 }, data: null, layout: stack() }],
    ...options,
  });
  const add = (id: NodeId, parent: NodeId | null = C) =>
    scene.add({ id, kind: 'mark', layer: 'l', pose: POSE, data: null, ...(parent ? { parent } : {}) });
  return { scene, add };
}

const labels = (scene: { historyEntries(): readonly { label: string }[] }) => scene.historyEntries().map((e) => e.label);

describe('Scene — a bare edit of a laid-out container', () => {
  it('records one entry under the edit\'s own label, and calls subscribers once', () => {
    const { scene, add } = makeLaidOut();
    expect(heard(scene, () => add(A)).calls).toBe(1);
    add(B);
    expect(heard(scene, () => scene.reorder(B, 0)).calls).toBe(1);
    expect(heard(scene, () => scene.setPose(C, { x: 100, y: 100, width: 80, height: 200 })).calls).toBe(1);
    expect(heard(scene, () => scene.move(B, null)).calls).toBe(1);
    expect(heard(scene, () => scene.move(B, C)).calls).toBe(1);
    expect(heard(scene, () => scene.remove(A)).calls).toBe(1);
    expect(heard(scene, () => scene.setLayout(C, null)).calls).toBe(1);
    expect(labels(scene)).toEqual(['add mark', 'add mark', 'reorder', 'setPose', 'move', 'move', 'remove', 'setLayout']);
    expect(scene.get(B)!.pose.width).toBe(80);
  });

  it('never coalesces, where the same edit of a leaf does', () => {
    const { scene, add } = makeLaidOut({ coalesceWindowMs: 1e9 });
    add(A);
    add(B, null);
    const depth = scene.historyIndex();
    scene.setPose(B, at(1));
    scene.setPose(B, at(2));
    expect(scene.historyIndex()).toBe(depth + 1);
    scene.setPose(C, { x: 100, y: 100, width: 60, height: 200 });
    scene.setPose(C, { x: 100, y: 100, width: 70, height: 200 });
    expect(scene.historyIndex()).toBe(depth + 3);
  });

  it('joins the batch it is made in, and records nothing inside untracked', () => {
    const { scene, add } = makeLaidOut();
    scene.batch('both', () => { add(A); add(B); });
    expect(labels(scene)).toEqual(['both']);
    scene.untracked(() => scene.reorder(B, 0));
    expect(labels(scene)).toEqual(['both']);
    // The container's first slot, in its frame.
    expect(scene.get(B)!.pose.y).toBe(0);
  });

  it('a refused bare move throws and leaves no entry', () => {
    const { scene, add } = makeLaidOut();
    add(A, null);
    scene.setArrivalHandler(() => null);
    const depth = scene.historyIndex();
    expect(() => scene.move(A, C)).toThrow();
    expect(scene.get(A)!.parent).toBeNull();
    expect(scene.historyIndex()).toBe(depth);
  });
});
