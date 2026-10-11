import type { GeometryProjection } from 'interactions/actions/geometryProjection';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import {
  resizePolicyOptions,
  useGeometryProjection,
  useResizePolicy
} from '../deps';

/** Subcomponent so we can conditionally render (and thus conditionally
 *  call) `useResizePolicy`. See parent's comment for why this
 *  must be gated rather than always-on. */
export function ResizePolicyRegistrar({
  options,
}: {
  options: UseResizeOptions<unknown>;
}) {
  useResizePolicy<unknown>(resizePolicyOptions(options));
  return null;
}

/** Subcomponent so we can conditionally render (and thus conditionally
 *  call) `useGeometryProjection`. Mirrors `ResizePolicyRegistrar` — the
 *  conditional mount ensures the dep is registered only when the consumer
 *  supplies a projection, so absent → dep undefined → actions stay pose-only. */
export function GeometryProjectionRegistrar({
  projection,
}: {
  projection: GeometryProjection;
}) {
  useGeometryProjection(projection);
  return null;
}
