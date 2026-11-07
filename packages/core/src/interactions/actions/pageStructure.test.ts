/** The scene actions leave pages and the page run alone, whatever selection names them. */
import { describe, expect, it } from 'vitest';
import { asNodeId } from 'core/scene/types';
import { RECT_POSE_DESCRIPTOR } from 'core/geometry/poseDescriptor';
import { ON_PAGE as R, PAGE_A as A, PAGE_B as B, pagedScene } from 'core/pages/pagedFixture';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { selectAllAction } from './defaults/selectAll';
import { deleteAction } from './defaults/delete';
import { duplicateSelection } from './defaults/duplicate';
import { clipboardCutAction } from './clipboard/action';
import { pickContainer } from './move/layout/container';
import { groupAction, ungroupAction } from './defaults/group';
import { flipAction } from './flip/action';
import { makeBooleanGroupAction } from './booleans/booleanGroupAction';
import { scenePoseFrame } from './poseFrame';
import type { RectPose } from 'core/scene/types';
import { areaSelectAction } from './defaults/areaSelect';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import { pressTarget } from 'tools/builtin/pressTarget';
import type { InvocationCtx } from '@weasel-js/routing';

/** A selection that holds whatever it was given, as a caller's own api may. */
function heldSelection(ids: string[]) {
  let held = ids;
  return { get: () => held, set: (next: string[]) => { held = next; }, adapterMethods: {} };
}

const run = (action: { invoker?: unknown }, deps: unknown) =>
  (action.invoker as { run(deps: never, params: never): void }).run(deps as never, undefined as never);

describe('scene actions in a paged scene', () => {
  it('select-all selects only the content', () => {
    const { scene } = pagedScene();
    const selection = heldSelection([]);
    run(selectAllAction, { scene, selection });
    expect(selection.get()).toEqual([R]);
  });

  it('delete and cut with a page forced into the selection delete nothing', () => {
    for (const action of [deleteAction, clipboardCutAction]) {
      const { scene, run: runId } = pagedScene();
      run(action, { scene, selection: heldSelection([A, runId]), clipboard: { copy: () => {} } });
      expect([runId, A, B, R].map((id) => scene.get(id) !== undefined)).toEqual([true, true, true, true]);
    }
  });

  it('a page or run never enters a clipboard or a duplicate', () => {
    const { scene, run: runId } = pagedScene();
    const before = scene.nodes.size;
    expect(duplicateSelection({ scene, selection: heldSelection([A, runId]) } as never, 12, 12)).toBeNull();
    expect(scene.nodes.size).toBe(before);
    expect(sceneToAdapter(scene).snapshotSelection([A, runId]).items).toEqual([]);
  });

  it('a drag over the pages is not offered the run as a drop container', () => {
    const { scene } = pagedScene();
    const session = {
      scene, pc: scene.composition, projection: RECT_POSE_DESCRIPTOR, view: undefined, verdict: () => true,
      layout: { getLayout: (id: string) => scene.get(asNodeId(id))?.layout ?? null },
    };
    expect(pickContainer(session as never, [], { x: 20, y: 20 })).toBeNull();
  });

  it('group and ungroup with a page or the run forced into the selection change nothing', () => {
    for (const action of [groupAction, ungroupAction]) {
      const { scene, run: runId } = pagedScene();
      const before = JSON.stringify(scene.toJSON().nodes);
      run(action, { scene, selection: heldSelection([A, B, runId]) });
      expect(JSON.stringify(scene.toJSON().nodes)).toBe(before);
    }
  });

  it('flip with a page or the run forced into the selection mirrors the content about its own box', () => {
    const { scene, run: runId } = pagedScene();
    const pages = JSON.stringify([runId, A, B].map((id) => scene.get(id)!.pose));
    (flipAction.invoker as { run(deps: never, params: never): void })
      .run({ scene, selection: heldSelection([B, runId, R]) } as never, { axis: 'x', pivot: 'union' } as never);
    expect(JSON.stringify([runId, A, B].map((id) => scene.get(id)!.pose))).toBe(pages);
    expect(scene.get(R)!.pose).toMatchObject({ x: 90, y: 10, width: 20, height: 10 });
  });

  it('group, ungroup and the boolean group count no page or run toward being enabled', () => {
    const { scene, run: runId } = pagedScene();
    const deps = (ids: string[]) => ({ scene, selection: heldSelection(ids) }) as never;
    expect(groupAction.enabled!(deps([A, runId]))).not.toBe(true);
    expect(ungroupAction.enabled!(deps([A]))).not.toBe(true);
    expect(makeBooleanGroupAction.enabled!(deps([R, A]))).not.toBe(true);
    expect(groupAction.enabled!(deps([R, A]))).toBe(true);
  });

  it('a marquee starting on empty paper selects the content inside it, not the page', () => {
    const { scene } = pagedScene();
    const selection = heldSelection([]);
    const tree = { getParent: (id: string) => scene.get(asNodeId(id))?.parent ?? null, getNode: (id: string) => scene.get(asNodeId(id)) };
    const dep = {
      hitTestArea: (bounds: never) => hitTestArea(scene, bounds),
      targetOf: (id: string) => pressTarget(tree, id, null),
      getSelection: selection.get,
      setSelection: selection.set,
    };
    const invoker = areaSelectAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const at = (x: number, y: number) => ({ world: { x, y }, modifiers: { shift: false }, deps: { areaSelect: dep } }) as unknown as InvocationCtx;
    const handle = invoker.start(at(5, 5), {});
    handle.onMove!(at(99, 45));
    handle.onEnd!(at(99, 45), 'commit');
    expect(selection.get()).toEqual([R]);
  });
});

describe('grouping across pages', () => {
  /** `R` (world 90..110 on page a) and a sliver on page b (world 110..113): their union overlaps a most. */
  function twoPages() {
    const { scene } = pagedScene();
    const onB = scene.add({ kind: 'mark', layer: 'ink', parent: B, pose: { x: 0, y: 10, width: 3, height: 10 }, data: {} });
    const frame = scenePoseFrame(scene);
    const worlds = () => [R, onB].map((id) => frame.world(id) as RectPose);
    return { scene, onB, before: worlds(), worlds };
  }

  for (const [name, action] of [['Group', groupAction], ['Make Boolean Group', makeBooleanGroupAction]] as const) {
    it(`${name} puts the new group on the page the members overlap most, the others reparenting into it`, () => {
      const { scene, onB, before, worlds } = twoPages();
      const selection = heldSelection([R, onB]);
      run(action, { scene, selection });
      const [group] = selection.get();
      expect(group).not.toBe(R);
      expect(scene.get(asNodeId(group!))!.parent).toBe(A);
      expect([scene.get(R)!.parent, scene.get(onB)!.parent]).toEqual([group, group]);
      expect(worlds()).toEqual(before);
    });

    it(`${name} moves a node following a member onto the page the member lands on`, () => {
      const { scene, onB } = twoPages();
      const link = scene.add({
        kind: 'mark', layer: 'ink', parent: B, pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
        dependsOn: [onB], derivePose: (_n, deps) => deps[0]?.pose ?? null,
      });
      run(action, { scene, selection: heldSelection([R, onB]) });
      expect(scene.get(link)!.parent).toBe(A);
    });
  }
});
