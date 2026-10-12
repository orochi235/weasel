/**
 * Wires the `geometryProjection` dep consumed by pose-transform actions.
 * A source that returns `undefined` is indistinguishable from no registration:
 * actions treat a missing dep as "no geometry rewrite".
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { GeometryProjection } from 'interactions/actions/geometryProjection';

export function useGeometryProjection(
  projection: GeometryProjection | undefined,
): void {
  const ref = useLatest(projection);
  useDepSource('geometryProjection', () => ref.current);
}
