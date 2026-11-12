import {
  booleanGroupFields,
  localizeWorldPoses,
  type AddNodeSpec,
  type NodeId,
  type PoseComposition,
} from '@weasel-js/core';
import type { SvgDraftPose } from './draftPose';
import type { SvgKitLeafData } from './fromKit';
import type { SvgSceneDraft } from './unpack';

/** Options for {@link svgDraftSpecs}. */
export interface SvgDraftSpecsOptions<TLayer extends string> {
  /** The layer every node goes on. */
  layer: TLayer;
  /** The scene's pose composition (`scene.composition`), which stores each pose in its container's frame. */
  composition: PoseComposition<SvgDraftPose>;
}

/**
 * `svgNodesToKitDrafts`'s drafts as the node specs a scene adds, parent before child: each
 * pose made local to the frame it is stored in, a boolean draft given `booleanGroupFields()` and
 * its operation as `data.boolean`, and `clip` and `hidden` carried over. Hand each to
 * `scene.add` or `createInsertOp`, in order.
 */
export function svgDraftSpecs<TData, TLayer extends string>(
  drafts: readonly SvgSceneDraft<TData>[],
  opts: SvgDraftSpecsOptions<TLayer>,
): AddNodeSpec<TData | SvgKitLeafData, TLayer, SvgDraftPose>[] {
  const specs = drafts.map((d): AddNodeSpec<TData | SvgKitLeafData, TLayer, SvgDraftPose> => {
    const base = {
      id: d.id as NodeId,
      layer: opts.layer,
      pose: d.pose,
      parent: d.parentId as NodeId | null,
      ...(d.clip ? { clip: d.clip } : {}),
      ...(d.hidden ? { hidden: true } : {}),
    };
    if (d.kind === 'group') return { ...base, kind: 'group', data: d.data };
    if (!d.boolean) return { ...base, kind: 'mark', data: d.data };
    // A boolean group derives its path from its operands, so the path the file drew is dropped.
    const { path: _path, ...rest } = d.data as Record<string, unknown>;
    return { ...base, ...booleanGroupFields<SvgDraftPose>(), data: { ...rest, boolean: d.boolean } as TData };
  });
  // Localized after the boolean fields are on: a boolean group is an envelope, not its operands' frame.
  return localizeWorldPoses(specs, opts.composition);
}
