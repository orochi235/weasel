import type { ActionDeps } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import { shapeSources } from '../selectionSubtree';
import { rotateOps } from './commit';
import { storedPreviews } from './frame';
import { captureTurn } from './session';

/** The ops that turn `selected` by `angle` radians the way a rotate drag
 *  would: about the selection's center, or each node about its own. */
export function rotateSelectionOps(
  scene: Scene<unknown, string, unknown>,
  selected: readonly string[],
  deps: Pick<ActionDeps, 'view' | 'poseDescriptor' | 'boundsIncludeStroke'>,
  angle: number,
  pivot: 'union' | 'each',
  label: string,
): Op[] {
  const ids = shapeSources(scene, selected) as NodeId[];
  if (ids.length === 0 || angle === 0) return [];
  const captured = captureTurn(scene, ids, deps, pivot);
  if (!captured) return [];
  const { turn, originPoses, poseFrame } = captured;
  const previews = storedPreviews({ scene, turn, poseFrame, view: deps.view }, angle);
  return rotateOps([...turn.origins.keys()], originPoses, previews, label);
}
