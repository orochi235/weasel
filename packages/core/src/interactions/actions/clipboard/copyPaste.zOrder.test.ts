/** A copy keeps the stacking of what it copied, whatever order the selection was made in. */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { createInsertOp } from 'core/ops/create';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { duplicateSelection } from '../defaults/duplicate';

type D = { label: string };

function stacked() {
  const scene = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const add = (label: string) => scene.add({ kind: 'mark', layer: 'main', data: { label }, pose: { x: 0, y: 0, width: 10, height: 10 } });
  const bottom = add('bottom');
  const top = add('top');
  return { scene, bottom, top };
}

const labels = (scene: ReturnType<typeof stacked>['scene']) =>
  [...scene.renderOrder()].map((id) => scene.get(id)!.data.label);

describe('stacking of a copy', () => {
  it('a duplicate of a selection made top first stacks as the originals do', () => {
    const { scene, bottom, top } = stacked();
    let held: readonly string[] = [top, bottom];
    const selection = { get: () => held, set: (next: readonly string[]) => { held = next; }, adapterMethods: undefined };
    duplicateSelection({ scene, selection: selection as unknown as SelectionApi } as never, 12, 12);
    expect(labels(scene)).toEqual(['bottom', 'top', 'bottom', 'top']);
  });

  it('a paste of a selection copied top first stacks as the originals do', () => {
    const { scene, bottom, top } = stacked();
    const adapter = sceneToAdapter(scene);
    const created = adapter.commitPaste(adapter.snapshotSelection([top, bottom]), { dx: 12, dy: 12 });
    scene.applyBatch(created.map((node) => createInsertOp({ node })), 'Paste', defaultCommitAdapter(scene as never));
    expect(labels(scene)).toEqual(['bottom', 'top', 'bottom', 'top']);
  });
});
