import {
  boundsOfPath, pathInWorld, remapPointValues,
  type GlMat3, type Path, type PathInWorldPose, type PointOrigin,
} from '@weasel-js/geom';
import type { PoseDescriptor } from '../../core/geometry/poseDescriptor';
import type { NodeId, PoseOverride, PoseOverrides } from '../../core/scene/types';
import { skinPath, type Skin } from '@weasel-js/animator';

/** The part of a scene a rig's skins read and write. */
export interface SkinScene<TPose> {
  get(id: NodeId): { pose: TPose; data?: unknown } | undefined;
  readonly overrides: PoseOverrides<TPose>;
  setPose(id: NodeId, pose: TPose): void;
  update(id: NodeId, patch: { data: never }): void;
}

/** Where a node's path is drawn, for a skin to bend: `null` for a node with none. */
export type RestPath<TPose> = (node: { pose: TPose; data?: unknown }) => Path | null;

/** The path in a node's `data.path`, carried through its pose as `kit:path` paints it. */
export function dataRestPath<TPose>(node: { pose: TPose; data?: unknown }): Path | null {
  const path = (node.data as { path?: Path } | null | undefined)?.path;
  return path ? pathInWorld(path, node.pose as PathInWorldPose) : null;
}

/**
 * `skin` after an edit to the points of the path it weighs: `origins` says where each point
 * of the new path came from, as `editAnchorSetTracked` answers. A point the edit made takes
 * weights between those of the points it lies between, and a joint left weighing nothing is
 * dropped.
 */
export function remapSkin(skin: Skin, origins: readonly (PointOrigin | null)[]): Skin {
  const next: Record<string, number[]> = {};
  for (const joint in skin) {
    const weights = remapPointValues(skin[joint], origins);
    if (weights.some((w) => w > 0)) next[joint] = weights;
  }
  return next;
}

interface Skinned<TPose> {
  node: NodeId;
  skin: Skin;
  rest: Path;
  restPose: TPose;
  entry: PoseOverride<TPose>;
}

/** A rig's skinned nodes, as `bindSkins` returns them. */
export interface SkinBinding {
  /** Every joint a skin weighs. */
  readonly joints: readonly string[];
  /** Bend each skinned path by `motions`, which holds every one of `joints`, into its node's
   *  pose override. The caller commits the overrides. */
  show(motions: ReadonlyMap<string, GlMat3>): void;
  /** Write each bent path and its bounds into the document. */
  write(): void;
  release(): void;
}

/** Read each skinned node's rest path and ready an override for it. */
export function bindSkins<TPose>(
  scene: SkinScene<TPose>,
  skins: Readonly<Record<NodeId, Skin>>,
  restPath: RestPath<TPose>,
  descriptor: PoseDescriptor<TPose>,
): SkinBinding {
  const skinned: Skinned<TPose>[] = [];
  const joints = new Set<string>();
  for (const [id, skin] of Object.entries(skins) as [NodeId, Skin][]) {
    const node = scene.get(id);
    if (!node) throw new Error(`bindRig: a skin names node "${id}", which the scene lacks.`);
    const rest = restPath(node);
    if (!rest) throw new Error(`bindRig: node "${id}" has no path to skin.`);
    for (const joint in skin) joints.add(joint);
    skinned.push({ node: id, skin, rest, restPose: node.pose, entry: {} });
  }
  let installed = false;
  return {
    joints: [...joints],
    show(motions) {
      for (const s of skinned) {
        const path = skinPath(s.rest, s.skin, motions);
        s.entry.path = path;
        s.entry.pose = descriptor.fromBounds(boundsOfPath(path), s.restPose);
        if (!scene.overrides.has(s.node, s.entry)) scene.overrides.set(s.node, s.entry);
      }
      installed = true;
    },
    write() {
      for (const s of skinned) {
        const { path, pose } = s.entry;
        if (path === undefined || pose === undefined) continue;
        const data = scene.get(s.node)?.data;
        scene.update(s.node, { data: { ...(data as object), path } as never });
        scene.setPose(s.node, pose);
      }
    },
    release() {
      if (!installed) return;
      installed = false;
      for (const s of skinned) scene.overrides.clear(s.node, s.entry);
    },
  };
}
