import type { ContainerBounds } from '../../layout/types';
import type { PoseComposition } from './composeFrame';
import { samePoseValue } from './poseSnapshot';

/** A container as a layout strategy sees it. */
export interface StrategyView<TPose> {
  /** The container upright, in its own frame, centered where its world pose is. */
  upright: TPose;
  bounds: ContainerBounds;
  /** Whether `upright` differs from the world pose; when not, both maps are the identity. */
  turned: boolean;
  /** A world pose into the strategy's space. */
  toStrategy(p: TPose): TPose;
  /** A pose the strategy returned, back to world. */
  toWorld(p: TPose): TPose;
}

/**
 * How a strategy sees a container at world `pose`: upright, in its own frame,
 * moved so its box is centered on the box `measure` gives the world pose. A
 * turned container's children are then laid out along its axes; an upright
 * one is seen as it is. `place` moves a pose from one box to another of the
 * same size.
 */
export function strategyView<TPose>(
  pose: TPose,
  { compose, decompose }: Pick<PoseComposition<TPose>, 'compose' | 'decompose'>,
  measure: (p: TPose) => ContainerBounds | null,
  place: (p: TPose, from: ContainerBounds, to: ContainerBounds) => TPose,
): StrategyView<TPose> | null {
  const own = decompose(pose, pose);
  const from = measure(own);
  const at = measure(pose);
  if (from === null || at === null) return null;
  const upright = place(own, from, {
    ...from,
    x: at.x + (at.width - from.width) / 2,
    y: at.y + (at.height - from.height) / 2,
  });
  const bounds = measure(upright);
  if (bounds === null) return null;
  const turned = !samePoseValue(upright, pose);
  return {
    upright,
    bounds,
    turned,
    toStrategy: (p) => (turned ? compose(upright, decompose(pose, p)) : p),
    toWorld: (p) => (turned ? compose(pose, decompose(upright, p)) : p),
  };
}
