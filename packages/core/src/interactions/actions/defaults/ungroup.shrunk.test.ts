/**
 * Counterexamples `sceneHistory.pbt.test.ts` shrank to, kept as examples. Ruled 2026-11-09: ungroup and delete
 * are disabled while a node they would move, rewrite, or remove is locked, and ungroup removes a dissolved group
 * from every dependent's `dependsOn`, so it deletes nothing but the group.
 */
import { describe, expect, it } from 'vitest';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { groupAction, ungroupAction } from './group';
import { deleteAction } from './delete';
import { clipboardCutAction } from '../clipboard/action';

const POSE = { x: 0, y: 0, width: 5, height: 5 };

function setup() {
  const scene = createScene<Record<string, never>, 'main'>({ systemLayers: [{ id: 'main' }] });
  const selection = { get: () => [...scene.getSelection()], set: (ids: NodeId[]) => scene.setSelection(ids) };
  const deps = { scene, selection } as never;
  const run = (action: typeof ungroupAction): void => { (action.invoker as ImmediateInvoker).run(deps, undefined as never); };
  const enabled = (action: typeof ungroupAction) => action.enabled?.(deps);
  /** A mark wrapped in a group by the group action, as the model test builds one. */
  const grouped = (): { mark: NodeId; group: NodeId } => {
    const mark = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    scene.setSelection([mark]);
    run(groupAction);
    return { mark, group: scene.get(mark)!.parent! };
  };
  return { scene, run, enabled, grouped };
}

describe('ungroup and delete over a locked child', () => {
  it('are disabled, and do nothing, while the group holds a locked child', () => {
    const { scene, run, enabled, grouped } = setup();
    const { mark, group } = grouped();
    scene.setLocked(mark, true);
    scene.setSelection([group]);
    const before = JSON.stringify(scene.toJSON());

    expect(enabled(ungroupAction)).toBe(ActionDisabledReason.Locked);
    expect(enabled(deleteAction)).toBe(ActionDisabledReason.Locked);
    expect(enabled(clipboardCutAction)).toBe(ActionDisabledReason.Locked);
    run(ungroupAction);
    run(deleteAction);
    expect(JSON.stringify(scene.toJSON())).toBe(before);
  });
});

describe('ungroup over a derivation from the container', () => {
  it('keeps a freed child that derives from the group, with no derivation left', () => {
    const { scene, run, enabled, grouped } = setup();
    const { mark, group } = grouped();
    scene.setDependsOn(mark, [group]);
    scene.setSelection([group]);

    expect(enabled(ungroupAction)).toBe(true);
    run(ungroupAction);
    expect(scene.get(group)).toBeUndefined();
    expect(scene.get(mark)?.dependsOn).toBeUndefined();
    expect(scene.getSelection()).toEqual([mark]);

    scene.undo();
    expect(scene.get(mark)?.dependsOn).toEqual([group]);
    expect(scene.get(mark)?.parent).toBe(group);
  });

  it('keeps the group a freed child lands in when that group derives from the one dissolved', () => {
    const { scene, run, grouped } = setup();
    const { mark, group: inner } = grouped();
    scene.setSelection([inner]);
    run(groupAction);
    const outer = scene.get(inner)!.parent!;
    scene.setDependsOn(outer, [inner]);
    scene.setSelection([inner]);

    run(ungroupAction);
    expect(scene.get(mark)?.parent).toBe(outer);
    expect(scene.get(outer)?.dependsOn).toBeUndefined();
    expect(scene.getSelection()).toEqual([mark]);
  });

  it('keeps a node elsewhere that derives from the group, with no derivation left', () => {
    const { scene, run, grouped } = setup();
    const { mark, group } = grouped();
    const follower = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {}, dependsOn: [group, mark] });
    scene.setSelection([group]);

    run(ungroupAction);
    expect(scene.get(group)).toBeUndefined();
    expect(scene.get(follower)?.dependsOn).toEqual([mark]);
  });
});
