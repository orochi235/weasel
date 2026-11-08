/**
 * A paste that lands in a container: every pasted node's stored pose must be
 * local to the frame it lands under, including those under an envelope root,
 * which defines no frame of its own.
 */
import { describe, expect, it } from 'vitest';
import { sceneToAdapter } from './sceneAdapter';
import { createScene } from 'core/scene/scene';
import { unionOfChildren } from 'core/scene/kitRegistry';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { expectSamePose } from 'core/scene/frameFixture';

type D = { label: string };
type S = Scene<D, 'main', RectPose>;

const OFFSET = { dx: 12, dy: 12 };

function scene(): S {
  const sc = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
  sc.add({
    id: asNodeId('box'), kind: 'group', layer: 'main', data: { label: 'box' },
    pose: { x: 100, y: 200, width: 300, height: 300 },
  });
  const env = sc.add({
    id: asNodeId('env'), kind: 'group', layer: 'main', data: { label: 'env' },
    pose: { x: 0, y: 0, width: 1, height: 1 },
    dependsOn: 'children', derivePose: unionOfChildren,
  });
  sc.add({
    id: asNodeId('a'), kind: 'mark', layer: 'main', parent: env, data: { label: 'a' },
    pose: { x: 10, y: 20, width: 20, height: 10 },
  });
  return sc;
}

describe('paste into a container', () => {
  it('stores the members of a pasted envelope local to the container it lands in', () => {
    const sc = scene();
    const adapter = sceneToAdapter(sc, { pasteInto: () => 'box' });
    const created = adapter.commitPaste(adapter.snapshotSelection(['env']), OFFSET);
    for (const n of created) {
      sc.add({
        id: n.id, kind: n.kind, layer: n.layer, parent: n.parent, pose: n.pose, data: n.data,
        ...(n.dependsOn !== undefined ? { dependsOn: n.dependsOn } : {}),
        ...(n.derivePose !== undefined ? { derivePose: n.derivePose } : {}),
      } as never);
    }
    const a = created.find((n) => n.data.label === 'a')!;
    const env = created.find((n) => n.data.label === 'env')!;
    expect(env.parent).toBe('box');
    expectSamePose(sceneToAdapter(sc).getWorldPose(a.id), { x: 22, y: 32, width: 20, height: 10 });
  });
});
