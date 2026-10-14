import type { ActionDeps, ResizeAnchor } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { resizeOps } from './commit';
import { posesInBox } from './frame';
import { captureResize } from './session';

/** `to`, given in units of `from` (`{ x: 0, y: 0, width: 1, height: 1 }` is
 *  `from` itself), in `from`'s own coordinates. */
export function boxInUnits(from: Bounds, to: Bounds): Bounds {
  return {
    x: from.x + to.x * from.width,
    y: from.y + to.y * from.height,
    width: to.width * from.width,
    height: to.height * from.height,
  };
}

/** `to` in units of `from`: the inverse of `boxInUnits`. A zero extent
 *  reads as unscaled on that axis. */
export function unitsOfBox(from: Bounds, to: Bounds): Bounds {
  const ux = from.width === 0 ? { x: 0, width: 1 } : { x: (to.x - from.x) / from.width, width: to.width / from.width };
  const uy = from.height === 0 ? { y: 0, height: 1 } : { y: (to.y - from.y) / from.height, height: to.height / from.height };
  return { x: ux.x, y: uy.y, width: ux.width, height: uy.height };
}

/** The ops that resize `selected` the way a handle drag would, taking the box
 *  it would resize to `units` of itself. The resize policy's expansion
 *  applies; its constraints and point snaps, which shape a pointer, do not. */
export function resizeSelectionOps(
  scene: Scene<unknown, string, unknown>,
  selected: readonly string[],
  anchor: ResizeAnchor,
  units: Bounds,
  deps: Pick<ActionDeps, 'poseDescriptor' | 'resizePolicy' | 'view' | 'geometryProjection'>,
  label: string,
): Op[] {
  if (selected.length === 0) return [];
  const captured = captureResize(scene, selected as NodeId[], anchor, deps);
  if (!captured) return [];
  const { place } = captured;
  const { previews } = posesInBox(place, boxInUnits(place.box.bounds, units));
  return resizeOps({ ...place, geometryProjection: deps.geometryProjection }, previews, label);
}
