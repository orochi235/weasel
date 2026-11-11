/**
 * Counterexamples `editActions.pbt.test.ts` and `dragActions.pbt.test.ts` shrank to, kept as plain examples.
 */
import { describe, it, expect } from 'vitest';
import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { RectPose } from 'core/geometry/rectPose';
import { createSetLockedOp } from 'core/ops/nodeFlags';
import { defaultCommitAdapter } from './defaultCommitAdapter';
import { alignCenterXAction, alignLeftAction } from './align/action';
import { distributeVerticalAction, distributeHorizontalAction } from './distribute/action';
import { flipAction } from './flip/action';
import { reorderForwardAction } from './defaults/reorder';
import { duplicateAction } from './defaults/duplicate';
import { nudgeRightAction } from './defaults/nudge';
import { groupAction } from './defaults/group';
import { depsOf, makeScene, type TestScene } from './pbt.fixture';

function add(scene: TestScene, pose: RectPose, kind: 'mark' | 'group' = 'mark', parent: NodeId | null = null): NodeId {
  const id = scene.mintId();
  scene.add({ id, kind, layer: 'main', pose, data: {}, parent });
  return id;
}

function run(action: Action, scene: TestScene, params?: Record<string, unknown>): void {
  (action.invoker as ImmediateInvoker).run(depsOf(scene), params as never);
}

const enabled = (action: Action, scene: TestScene, params?: Record<string, unknown>) =>
  action.enabled!(depsOf(scene), undefined, undefined, params);

const unit = { x: 0, y: 0, width: 1, height: 1 };

describe('edit actions are disabled where they would change nothing', () => {
  it('align to the union of one item', () => {
    const scene = makeScene();
    scene.setSelection([add(scene, unit)]);
    expect(enabled(alignLeftAction, scene)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('align of items already aligned', () => {
    const scene = makeScene();
    scene.setSelection([add(scene, unit), add(scene, { ...unit, y: 5, width: 3 })]);
    expect(enabled(alignLeftAction, scene)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('distribute of items already spaced', () => {
    const scene = makeScene();
    scene.setSelection([add(scene, unit), add(scene, { ...unit, x: 5 }), add(scene, { ...unit, x: 10 })]);
    expect(enabled(distributeHorizontalAction, scene)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('flip in place of an upright rect, which is its own mirror', () => {
    const scene = makeScene();
    scene.setSelection([add(scene, unit)]);
    expect(enabled(flipAction, scene, { axis: 'x' })).toBe(ActionDisabledReason.NotApplicable);
    const at = scene.historyIndex();
    run(flipAction, scene, { axis: 'x' });
    expect(scene.historyIndex()).toBe(at);
  });

  it('bring to front of the frontmost item', () => {
    const scene = makeScene();
    add(scene, unit);
    scene.setSelection([add(scene, unit)]);
    expect(enabled(reorderForwardAction, scene, { distance: 'extreme' })).toBe(ActionDisabledReason.NotApplicable);
  });
});

describe('distribute centers', () => {
  it('keeps the outermost centers where they were when boxes start level', () => {
    // Sorted by their top edges, the two short boxes came first and last, and the tall one's center moved.
    const scene = makeScene();
    const a = add(scene, unit);
    const tall = add(scene, { ...unit, height: 2 });
    const b = add(scene, unit);
    scene.setSelection([a, tall, b]);
    expect(enabled(distributeVerticalAction, scene, { mode: 'centers' })).toBe(true);
    run(distributeVerticalAction, scene, { mode: 'centers' });
    const center = (id: NodeId) => { const p = scene.get(id)!.pose; return p.y + p.height / 2; };
    expect(center(tall)).toBe(1);
    expect([center(a), center(b)].sort()).toEqual([0.5, 0.75]);
  });

  it('plans no move for what it spaced, whatever the rounding', () => {
    const scene = makeScene();
    scene.setSelection([
      add(scene, { ...unit, height: 32 }), add(scene, unit), add(scene, unit), add(scene, { ...unit, y: 15 }),
    ]);
    run(distributeVerticalAction, scene, { mode: 'centers' });
    expect(enabled(distributeVerticalAction, scene, { mode: 'centers' })).toBe(ActionDisabledReason.NotApplicable);
  });
});

it('align of a turned rect plans no move once aligned, whatever the rounding', () => {
  const scene = makeScene();
  scene.setSelection([add(scene, unit), add(scene, { ...unit, x: 1, rotation: -Math.PI / 4 })]);
  run(alignCenterXAction, scene);
  expect(enabled(alignCenterXAction, scene)).toBe(ActionDisabledReason.NotApplicable);
});

describe('locks', () => {
  it('a reorder that would shift a locked sibling is disabled, and runs as it says', () => {
    const scene = makeScene();
    const a = add(scene, unit);
    const b = add(scene, unit);
    scene.applyBatch([createSetLockedOp({ id: b, from: false, to: true })], 'Lock', defaultCommitAdapter(scene));
    scene.setSelection([a]);
    expect(enabled(reorderForwardAction, scene, { distance: 'adjacent' })).toBe(ActionDisabledReason.Locked);
    const at = scene.historyIndex();
    expect(() => run(reorderForwardAction, scene, { distance: 'adjacent' })).not.toThrow();
    expect(scene.historyIndex()).toBe(at);
    expect([...scene.roots]).toEqual([a, b]);
  });

  it('duplicate copies a locked group inside the selection, children and lock included', () => {
    const scene = makeScene();
    const outer = add(scene, unit, 'group');
    const inner = add(scene, unit, 'group', outer);
    add(scene, unit, 'mark', inner);
    scene.applyBatch([createSetLockedOp({ id: inner, from: false, to: true })], 'Lock', defaultCommitAdapter(scene));
    scene.setSelection([outer]);
    expect(() => run(duplicateAction, scene)).not.toThrow();
    const [copy] = scene.getSelection();
    expect(copy).not.toBe(outer);
    const [innerCopy] = scene.childrenOf(copy!);
    expect(scene.get(innerCopy!)!.locked).toBe(true);
    expect(scene.childrenOf(innerCopy!)).toHaveLength(1);
    expect(scene.undo()).toBe(true);
    expect(scene.nodes.size).toBe(3);
  });
});

describe('immediate actions near the double range', () => {
  it('a nudge rounding absorbs is off and records nothing', () => {
    const scene = makeScene();
    const a = add(scene, { x: 1e308, y: 0, width: 1, height: 1 });
    scene.setSelection([a]);
    expect(enabled(nudgeRightAction, scene, { magnitude: 'big' })).toBe(ActionDisabledReason.NotApplicable);
    const at = scene.historyIndex();
    run(nudgeRightAction, scene, { magnitude: 'big' });
    expect(scene.historyIndex()).toBe(at);
  });

  it('a flip whose mirror image leaves the double range is off and writes nothing', () => {
    const scene = makeScene();
    const a = add(scene, { x: 1e308, y: 0, width: 1, height: 1 });
    const b = add(scene, { x: -1e308, y: 0, width: 1, height: 1 });
    scene.setSelection([a, b]);
    expect(enabled(flipAction, scene, { axis: 'x', pivot: 'union' })).toBe(ActionDisabledReason.NotApplicable);
    run(flipAction, scene, { axis: 'x', pivot: 'union' });
    expect(scene.get(a)!.pose.x).toBe(1e308);
  });

  it('a group whose container would leave the double range is off and adds nothing', () => {
    const scene = makeScene();
    const a = add(scene, { x: 0, y: -1e308, width: 1, height: 1e308 });
    const b = add(scene, { x: 0, y: 0, width: 1, height: 1e308 });
    scene.setSelection([a, b]);
    expect(enabled(groupAction, scene)).toBe(ActionDisabledReason.NotApplicable);
    run(groupAction, scene);
    expect(scene.nodes.size).toBe(2);
  });

  it('a group of members on two layers is off', () => {
    const scene = makeScene();
    const a = add(scene, { x: 0, y: 0, width: 1, height: 1 });
    const b = scene.mintId();
    scene.add({ id: b, kind: 'mark', layer: 'top', pose: { x: 5, y: 0, width: 1, height: 1 }, data: {} });
    scene.setSelection([a, b]);
    expect(enabled(groupAction, scene)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('an align that would carry a box past the double range is off and moves nothing', () => {
    const scene = makeScene();
    const a = add(scene, { x: 0, y: 0, width: -1, height: 1 });
    const turned = { x: -1, y: Number.MAX_VALUE, width: 1, height: 1, rotation: 1.5707963267948968, transform: [1, -9.9579925010296e-17, -9.9579925010296e-17, -1] as const };
    scene.add({ id: '__proto__' as NodeId, kind: 'mark', layer: 'main', pose: turned, data: {} });
    scene.setSelection(['__proto__' as NodeId, a]);
    expect(enabled(alignLeftAction, scene)).toBe(ActionDisabledReason.NotApplicable);
    run(alignLeftAction, scene);
    expect(scene.get(a)!.pose.x).toBe(0);
    expect(scene.get('__proto__' as NodeId)!.pose.x).toBe(-1);
  });
});
