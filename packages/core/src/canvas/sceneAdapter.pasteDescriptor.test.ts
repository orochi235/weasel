import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { sceneToAdapter } from './sceneAdapter';

interface Pose { x: number; y: number; width: number; height: number; via?: string }
interface PosedNode { data: { own: boolean } }

const rect = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<Pose, PosedNode>;
const OWN: PoseDescriptor<Pose, PosedNode> = {
  ...rect,
  // Reads its box 100 to the right, and stamps what it translates.
  getBounds: (p) => ({ x: p.x + 100, y: p.y, width: p.width, height: p.height }),
  translate: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy, via: 'own' }),
};
const DESCRIPTOR: PoseDescriptor<Pose, PosedNode> = {
  ...rect,
  forNode: (node) => (node.data.own ? OWN : DESCRIPTOR),
};

function setup() {
  const scene = createScene<{ own: boolean }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', data: { own: true }, pose: { x: 10, y: 10, width: 5, height: 5 } });
  const adapter = sceneToAdapter(scene, { poseDescriptor: DESCRIPTOR as never });
  return { adapter, snapshot: adapter.snapshotSelection!([id]) };
}

describe('commitPaste reads a node through its own pose descriptor', () => {
  it('to offset it', () => {
    const { adapter, snapshot } = setup();
    const [pasted] = adapter.commitPaste!(snapshot, { dx: 12, dy: 12 });
    expect(pasted.pose).toEqual({ x: 22, y: 22, width: 5, height: 5, via: 'own' });
  });

  it('to find the corner a drop point lands on', () => {
    const { adapter, snapshot } = setup();
    const [pasted] = adapter.commitPaste!(snapshot, { dx: 0, dy: 0 }, { dropPoint: { x: 200, y: 50 } });
    // Its box starts at x = 110, so landing that on 200 moves the pose by 90.
    expect(pasted.pose).toMatchObject({ x: 100, y: 50 });
  });
});
