/**
 * A dependency's pose in the frame of the node reading it. Under a composing
 * strategy a stored pose is local to its container, so a node deriving from
 * something in another container would otherwise read it in that
 * container's frame and place itself as though the two frames were one.
 */
import { boxToBox, multiply, poseFrameInverseOf, poseFrameOf, transformPath, type Affine, type Path } from '@weasel-js/geom';
import { composeWorldPose, composesFrames, frameAtOrAbove, type PoseAdapter, type PoseComposition } from './composeFrame';
import { derivedPartsOf, pathFromParts } from './derivedParts';
import type { NodeId } from './types';

/** The parts of a node the rebase reads. */
interface FramedNode {
  id: NodeId;
  parent?: NodeId | null;
}

/** `(depId, pose) => that pose in `reader`'s frame`, or `null` when every
 *  pose is already in one frame — the absolute-pose model. `poseOf` answers
 *  each node's own, local pose. */
export function depFrameRebase<TPose>(
  composition: PoseComposition<TPose> | undefined,
  reader: FramedNode,
  get: (id: NodeId) => FramedNode | undefined,
  poseOf: (id: NodeId) => TPose,
  definesFrame: (id: NodeId) => boolean,
): ((depId: NodeId, pose: TPose) => TPose) | null {
  if (composition === undefined || !composesFrames(composition)) return null;
  const adapter: PoseAdapter<TPose> = {
    getPose: (id) => poseOf(id as NodeId),
    getParent: (id) => get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => definesFrame(id as NodeId),
  };
  const frame = frameAtOrAbove(adapter, reader.parent ?? null);
  return (depId, pose) => {
    const own = frameAtOrAbove(adapter, get(depId)?.parent ?? null);
    if (own === frame) return pose;
    const world = own === null ? pose : composition.compose(composeWorldPose(adapter, own, composition.compose), pose);
    return frame === null ? world : composition.decompose(composeWorldPose(adapter, frame, composition.compose), world);
  };
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function isBox(pose: unknown): pose is Box {
  const p = pose as Partial<Box> | null;
  return typeof p === 'object' && p !== null
    && typeof p.x === 'number' && typeof p.y === 'number'
    && typeof p.width === 'number' && typeof p.height === 'number';
}

/**
 * A dependency's derived `path`, drawn in its own frame, carried into the
 * reader's — the frame change that took its pose `from` to `to`. A pose that
 * is not a box gives no plane to carry a path through, and leaves it as it is.
 */
export function carryDepPath(path: Path, from: unknown, to: unknown): Path {
  if (!isBox(from) || !isBox(to)) return path;
  const back = poseFrameInverseOf(from);
  const fwd = poseFrameOf(to);
  let m: Affine = boxToBox(from.x, from.y, from.width, from.height, to.x, to.y, to.width, to.height);
  if (back !== null) m = multiply(m, back);
  if (fwd !== null) m = multiply(fwd, m);
  // Read every frame, and a derivation's memo compares the path it read by reference.
  const key = m.join(',');
  const held = carried.get(path);
  if (held?.key === key) return held.path;
  const parts = derivedPartsOf(path);
  const out = parts === undefined
    ? transformPath(path, m)
    : pathFromParts(parts.map((part) => ({ ...part, path: transformPath(part.path, m) })))!;
  carried.set(path, { key, path: out });
  return out;
}

const carried = new WeakMap<Path, { key: string; path: Path }>();
