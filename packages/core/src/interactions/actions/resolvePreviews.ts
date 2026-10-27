/**
 * What an in-flight gesture is proposing, resolved against the scene.
 *
 * An ongoing action names the ids it previews on its handle. A transform —
 * move, resize, rotate — publishes their poses to the scene's overrides, and
 * other actions answer `previewPose` on the handle. Resolving them means
 * knowing which ids are in flight, which of those are roots, whose preview
 * wins when two sources name the same id, and which are merely displaced
 * rather than dragged. None of that is about drawing, and a consumer with its
 * own renderer needs all of it.
 */

import type { GesturePreviewSource } from '../../canvas/gestureBounds';
import type { Node, NodeId, Scene } from '../../core/scene/types';
import { asNodeId } from '../../core/scene/types';
import { definesFrame, effectivePose } from '../../core/scene/effectivePose';
import { composeWorldPose, composesFrames, type PoseAdapter } from '../../core/scene/composeFrame';
import { viewPoseAdapter } from '../../core/scene/scrollOffsets';

/** One node an in-flight gesture is previewing, as {@link resolvePreviews} returns it. */
export interface PreviewNode<TData, TLayer extends string, TPose> {
  id: NodeId;
  /** The node as committed. */
  node: Node<TData, TLayer, TPose>;
  /** Where the node draws, in world: the pose a source previews, else its
   *  effective pose — where the scene's overrides put it mid-transform —
   *  folded through every container's frame, previewed or not, and scrolled
   *  as the view scrolls it. */
  pose: TPose;
  /** The interim data, or the committed one when only the pose is in flight. */
  data: TData;
  /**
   * The gesture is not carrying this one under the pointer — a layout sibling
   * reflowing into its destination slot. It reads better painted settled.
   */
  opaque: boolean;
  /** Previewed descendants, and those a previewed frame carries, so a
   *  container's ghost brings its children. */
  children: PreviewNode<TData, TLayer, TPose>[];
}

/** First non-null answer across sources, in the order given. */
function firstNonNull<T>(
  sources: readonly GesturePreviewSource[],
  id: string,
  read: (source: GesturePreviewSource, id: string) => unknown,
): T | null {
  for (const source of sources) {
    const value = read(source, id);
    if (value != null) return value as T;
  }
  return null;
}

/**
 * The previewing subtrees, as roots. A previewed node whose parent is also
 * previewing is a child of that parent's entry rather than a root of its own,
 * which is what lets a caller draw a container and its contents as one thing.
 * A previewed container whose pose is a frame brings every child it carries,
 * previewed or not. A source previews a pose in the frame the node is stored
 * in; each entry's pose is in world.
 *
 * An id with no node is skipped: an insert previews before the node it will
 * create exists.
 */
export function resolvePreviews<TData, TLayer extends string, TPose>(
  sources: Iterable<GesturePreviewSource>,
  scene: Scene<TData, TLayer, TPose>,
): PreviewNode<TData, TLayer, TPose>[] {
  const list = [...sources];
  const ids = new Set<string>();
  for (const source of list) {
    const previewing = source.previewIds?.();
    if (!previewing) continue;
    for (const id of previewing) ids.add(id);
  }
  if (ids.size === 0) return [];

  const opaque = new Set<string>();
  for (const source of list) {
    const settled = source.previewOpaqueIds?.();
    if (!settled) continue;
    for (const id of settled) opaque.add(id);
  }

  const composition = scene.composition;
  const framed = composesFrames(composition);
  const shown: PoseAdapter<TPose> = viewPoseAdapter(scene, {
    getPose: (id) => firstNonNull<TPose>(list, id, (s, i) => s.previewPose?.(i)) ?? effectivePose(scene, scene.get(asNodeId(id))!),
    getParent: (id) => scene.get(asNodeId(id))?.parent ?? null,
    definesFrame: (id) => {
      const node = scene.get(asNodeId(id));
      return node === undefined || definesFrame(node);
    },
  } as PoseAdapter<TPose>);

  // `riding`: the frame `id` is stored in is drawn here, which an envelope's
  // children share with it.
  const build = (id: string, carriedOpaque = false, riding = false): PreviewNode<TData, TLayer, TPose> | null => {
    const node = scene.get(asNodeId(id));
    if (!node) return null;
    const data = firstNonNull<TData>(list, id, (s, i) => s.previewData?.(i));
    const isOpaque = carriedOpaque || opaque.has(id);
    const carries = framed && (definesFrame(node) || riding);

    const children: PreviewNode<TData, TLayer, TPose>[] = [];
    for (const childId of scene.childrenOf(asNodeId(id))) {
      if (!ids.has(childId) && !carries) continue;
      const child = build(childId, isOpaque && !ids.has(childId), carries);
      if (child) children.push(child);
    }

    return {
      id: asNodeId(id),
      node,
      pose: composeWorldPose(shown, id, composition.compose),
      data: data ?? node.data,
      opaque: isOpaque,
      children,
    };
  };

  const roots: PreviewNode<TData, TLayer, TPose>[] = [];
  for (const id of ids) {
    const parent = scene.get(asNodeId(id))?.parent;
    if (parent != null && ids.has(parent)) continue;
    const root = build(id);
    if (root) roots.push(root);
  }
  return roots;
}

/** Every entry in the forest, parents before their children. */
export function flattenPreviews<TData, TLayer extends string, TPose>(
  roots: readonly PreviewNode<TData, TLayer, TPose>[],
): PreviewNode<TData, TLayer, TPose>[] {
  const out: PreviewNode<TData, TLayer, TPose>[] = [];
  const walk = (entry: PreviewNode<TData, TLayer, TPose>) => {
    out.push(entry);
    for (const child of entry.children) walk(child);
  };
  for (const root of roots) walk(root);
  return out;
}
