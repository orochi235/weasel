import type { GestureContext } from 'interactions/gestures/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { Animator } from '../types';

/** One flick still traveling: the nodes it carries, and how a new drag of one stops it. */
export interface Coast {
  ids: readonly string[];
  stop(): void;
}

/** What a coast is started with. */
export interface CoastArgs<TPose> {
  animator: Animator;
  ctx: GestureContext<TPose>;
  /** Release velocity in world units a second. */
  vx: number;
  vy: number;
  friction: number;
  bounds: { x: number; y: number; width: number; height: number } | undefined;
  boundary: 'stop' | 'continue';
  d: PoseDescriptor<TPose>;
  /** The behavior's running coasts. A coast adds itself and takes itself out as it ends. */
  coasts: Set<Coast>;
}

let nextCoast = 0;

/** A cancel key no other coast holds. */
export const coastKey = (): string => `momentum:${nextCoast++}`;

/** Whether two bounds are the same box. */
export const sameBounds = (a: Bounds, b: Bounds): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** A top-left corner held inside `bounds`, and which axes that moved. */
export function clampCorner(
  bounds: CoastArgs<unknown>['bounds'],
  x: number,
  y: number,
): { nx: number; ny: number; hitX: boolean; hitY: boolean } {
  if (!bounds) return { nx: x, ny: y, hitX: false, hitY: false };
  const nx = Math.min(Math.max(x, bounds.x), bounds.x + bounds.width);
  const ny = Math.min(Math.max(y, bounds.y), bounds.y + bounds.height);
  return { nx, ny, hitX: nx !== x, hitY: ny !== y };
}
