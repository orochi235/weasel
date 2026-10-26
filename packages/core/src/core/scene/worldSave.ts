/**
 * Reading a save from before a scene's poses composed by default. Versions 1
 * and 2 stored every pose as world; version 3 stores a child's pose in the
 * frame of the nearest container that defines one.
 */
import { composeWorldPose, type PoseAdapter, type PoseComposition } from './composeFrame';
import { scenePoseAdapter } from './scenePoseAdapter';
import { definesFrame } from './effectivePose';
import type { NodeId, Scene } from './types';

/** What localizing reads of a node: where it sits, its pose, and whether it is a frame. */
export interface PlacedSpec<TPose> {
  id?: NodeId | string;
  parent?: NodeId | string | null;
  pose: TPose;
  dependsOn?: unknown;
  derivePose?: unknown;
}

/**
 * `specs`, whose every pose is world, with each pose made local to the frame
 * it is stored in under `composition`: an old save as it loads, or a tree an
 * importer measured in world. A child of a container whose pose derives from
 * its children shares that container's frame, so it is rebased against the
 * frame above it.
 */
export function localizeWorldPoses<TPose, TSpec extends PlacedSpec<TPose>>(
  specs: readonly TSpec[],
  composition: PoseComposition<TPose>,
): TSpec[] {
  const byId = new Map<string, TSpec>();
  for (const spec of specs) if (spec.id !== undefined) byId.set(spec.id, spec);
  const frameOf = (spec: TSpec): TSpec | null => {
    const seen = new Set<string>();
    let at = spec.parent == null ? undefined : byId.get(spec.parent);
    while (at !== undefined && at.id !== undefined && !seen.has(at.id)) {
      if (definesFrame(at)) return at;
      seen.add(at.id);
      at = at.parent == null ? undefined : byId.get(at.parent);
    }
    return null;
  };
  return specs.map((spec) => {
    const frame = frameOf(spec);
    return frame === null ? spec : { ...spec, pose: composition.decompose(frame.pose, spec.pose) };
  });
}

/**
 * Where each of `specs` draws: its pose folded through the frames above it
 * under `composition`, by id. The inverse of {@link localizeWorldPoses}, for
 * a reader of a spec list that is not in a scene yet.
 */
export function worldPosesOf<TPose, TSpec extends PlacedSpec<TPose>>(
  specs: readonly TSpec[],
  composition: PoseComposition<TPose>,
): Map<string, TPose> {
  const byId = new Map<string, TSpec>();
  for (const spec of specs) if (spec.id !== undefined) byId.set(spec.id, spec);
  return new Map([...byId.keys()].map((id) => [id, composeWorldPose({
    getPose: (at) => byId.get(at)!.pose,
    getParent: (at) => {
      const parent = byId.get(at)?.parent;
      return parent == null || !byId.has(parent) ? null : parent;
    },
    definesFrame: (at) => {
      const spec = byId.get(at);
      return spec === undefined || definesFrame(spec);
    },
  }, id, composition.compose)]));
}

/**
 * `specs`, whose every pose is world, as they are stored once added to
 * `scene`: each made local to the frame it lands in, whether that frame is
 * among `specs` or already in the scene.
 */
export function localizeInScene<TPose, TSpec extends PlacedSpec<TPose>>(
  scene: Scene<unknown, string, TPose>,
  specs: readonly TSpec[],
): TSpec[] {
  const own = new Set<string>();
  for (const spec of specs) if (spec.id !== undefined) own.add(spec.id);
  // Each container already in the scene, at the world pose it is drawn at.
  const above = new Map<string, PlacedSpec<TPose>>();
  const poses = scenePoseAdapter(scene as never) as unknown as PoseAdapter<TPose>;
  const reach = (id: NodeId | string | null | undefined): void => {
    while (id != null && !own.has(id) && !above.has(id)) {
      const node = scene.get(id as NodeId);
      if (node === undefined) return;
      above.set(id, { ...node, pose: composeWorldPose(poses, id, scene.composition.compose) });
      id = node.parent;
    }
  };
  for (const spec of specs) reach(spec.parent);
  if (above.size === 0) return localizeWorldPoses(specs, scene.composition);
  const all = localizeWorldPoses<TPose, PlacedSpec<TPose>>([...above.values(), ...specs], scene.composition);
  return all.slice(above.size) as TSpec[];
}
