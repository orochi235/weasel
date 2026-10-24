import type { NodeId, Scene } from '@weasel-js/core';

interface Positioned { id: string; x: number; y: number }
type Pose = { x: number; y: number; width: number; height: number };
type GraphScene = Scene<{ group: number }, 'graph', Pose>;

/** The simulation's own override entry per node, per scene. */
const entriesOf = new WeakMap<GraphScene, Map<NodeId, { pose: Pose }>>();

/**
 * Mirror the simulation's positions into the scene for **this frame only**.
 *
 * The pose buffer is the override entry's own object, mutated in place, so a
 * settle allocates one pose per node rather than one per node per frame.
 */
export function syncGraphPoses(scene: GraphScene, nodes: readonly Positioned[], radius: number): void {
  let entries = entriesOf.get(scene);
  if (entries === undefined) entriesOf.set(scene, entries = new Map());
  for (const n of nodes) {
    const id = n.id as NodeId;
    let entry = entries.get(id);
    if (entry === undefined) entries.set(id, entry = { pose: { x: 0, y: 0, width: radius * 2, height: radius * 2 } });
    if (!scene.overrides.has(id, entry)) scene.overrides.set(id, entry);
    const pose = entry.pose;
    pose.x = n.x - radius;
    pose.y = n.y - radius;
  }
  scene.overrides.commit();
}

/** Promote the settled layout to document state: one undo entry, overrides gone. */
export function bakeGraphPoses(scene: GraphScene, nodes: readonly Positioned[], radius: number): void {
  scene.batch('settle', () => {
    for (const n of nodes) {
      scene.setPose(n.id as NodeId, {
        x: n.x - radius,
        y: n.y - radius,
        width: radius * 2,
        height: radius * 2,
      });
    }
  });
  scene.overrides.clearAll();
}
