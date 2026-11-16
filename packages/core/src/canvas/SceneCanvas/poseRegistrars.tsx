import type { GeometryProjection } from 'interactions/actions/geometryProjection';
import { useGeometryProjection } from '../deps';

/** Subcomponent so we can conditionally render (and thus conditionally call) `useGeometryProjection`: the dep is
 *  registered only when the consumer supplies a projection, so absent → dep undefined → actions stay pose-only. */
export function GeometryProjectionRegistrar({
  projection,
}: {
  projection: GeometryProjection;
}) {
  useGeometryProjection(projection);
  return null;
}
