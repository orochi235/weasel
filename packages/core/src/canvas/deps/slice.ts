/**
 * The `slice` dep `sliceAction` and `useSliceTool` commit their cuts through.
 *
 * `<SceneCanvas>` publishes `useSliceDepSource` over its own scene. A consumer
 * replaces it with `useSliceDep` (or `useDepSource('slice', …)`) from under
 * the canvas; the newest registration wins, and a canvas child registers
 * after the canvas's own.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { SliceDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId, Node } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { Path } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { pathInWorld, worldEditToStorage, type PathInWorldPose } from 'features/paths/pathInWorld';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import { freshNodeId } from 'interactions/actions/defaults/freshNodeId';
import { computeSliceOps, type SliceLeaf } from 'interactions/actions/defaults/sliceOps';
import type { PoseComposition } from 'features/groups/composePose';

/** Publish how a slice (knife cut) is performed, so the `slice` action can
 *  run against the consumer's geometry. */
export function useSliceDep(dep: SliceDep): void {
  const depRef = useLatest(dep);

  useDepSource('slice', (): SliceDep => depRef.current);
}

interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

/**
 * The kit `slice` dep: cut every leaf the cut crosses and swap it for its
 * pieces in one undoable batch.
 *
 * A leaf is cut when its `data.path` is a `Path` and `poseDescriptor` can read
 * its world pose as a box and a rotation; a leaf on a locked layer, or one
 * whose geometry derives from other nodes, is passed over. Each path is drawn
 * into world space the way the renderer draws it, so a child is cut where it
 * appears, and each piece is mapped back into the source's frame: it keeps the
 * source's rotation in its pose when the descriptor can write one
 * (`withRotation`), and has the rotation baked into its path otherwise. The
 * piece's pose is then stored in its parent's frame through `poseComposition`.
 * The pieces of a selected leaf take its place in the selection.
 */
export function useSliceDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  poseComposition?: PoseComposition<unknown>,
  poseDescriptor?: PoseDescriptor<unknown>,
): void {
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const adapterRef = useLatest(adapter);
  const compositionRef = useLatest(poseComposition);
  const descriptorRef = useLatest(poseDescriptor);

  useDepSource('slice', (): SliceDep => ({
    commit(cut) {
      const sc = sceneRef.current;
      const frame = scenePoseFrame(sc, compositionRef.current);
      const descriptor = descriptorRef.current ?? AUTO_POSE_DESCRIPTOR;
      const leaves: SliceLeaf<Node<unknown, string, unknown>>[] = [];
      const drawnAt = new Map<string, DrawnPose>();
      for (const node of sc.renderOrderNodes()) {
        const path = sliceablePath(sc, node);
        if (!path) continue;
        const drawn = drawnPose(poseDescriptorForNode(descriptor, node), frame.world(node.id));
        if (!drawn) continue;
        drawnAt.set(node.id, drawn);
        leaves.push({ node, index: siblingIndex(sc, node), worldPath: pathInWorld(path, drawn.box) });
      }

      const sel = selectionRef.current;
      const { ops, nextSelection } = computeSliceOps({
        leaves,
        cut,
        nextId: freshNodeId,
        selection: sel.get(),
        placePiece: (leaf, piece) => {
          const stored = storePiece(drawnAt.get(leaf.node.id)!, piece);
          return { pose: frame.local(leaf.node.id, stored.pose), path: stored.path };
        },
      });
      if (ops.length === 0) return;
      adapterRef.current.applyOps(ops, 'Slice');
      if (nextSelection) sel.set(nextSelection as NodeId[]);
    },
  }));
}

/** A leaf's world pose, and the box and rotation its path is drawn through. */
interface DrawnPose {
  world: unknown;
  g: PoseDescriptor<unknown>;
  box: PathInWorldPose;
}

function drawnPose(g: PoseDescriptor<unknown>, world: unknown): DrawnPose | null {
  const b = g.getBounds(world);
  if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite)) return null;
  const rotation = g.getRotation?.(world) ?? 0;
  return { world, g, box: { x: b.x, y: b.y, width: b.width, height: b.height, rotation } };
}

/** A world-space piece as a world pose of the source's kind plus the path it draws. */
function storePiece({ world, g, box }: DrawnPose, piece: Path): { pose: unknown; path: Path } {
  const keepsRotation = !!g.withRotation && g.supportsRotation?.(world) !== false;
  const rotation = box.rotation ?? 0;
  if (rotation !== 0 && !keepsRotation) {
    const baked = worldEditToStorage({ ...box, rotation: 0 }, piece);
    return { pose: g.fromBounds(baked.pose, world), path: baked.path };
  }
  const { pose: b, path } = worldEditToStorage(box, piece);
  const dst = { x: b.x, y: b.y, width: b.width, height: b.height };
  const pose = g.remapBounds(world, g.getBounds(world), dst);
  return { pose: rotation !== 0 ? g.withRotation!(pose, rotation) : pose, path };
}

function sliceablePath(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>): Path | null {
  if (node.kind !== 'leaf' || node.derivePath || node.derivePose) return null;
  if (scene.isLocked(node.id)) return null;
  const path = (node.data as { path?: unknown } | null)?.path as Path | undefined;
  return path && (path.kind === 'rect' || path.kind === 'polygon') ? path : null;
}

function siblingIndex(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>): number {
  const siblings = node.parent == null ? scene.roots : scene.childrenOf(node.parent);
  return siblings.indexOf(node.id);
}
