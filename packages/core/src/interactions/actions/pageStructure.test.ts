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
});
