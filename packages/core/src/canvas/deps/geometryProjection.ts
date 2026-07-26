/**
 * `useGeometryProjection` — wires the `geometryProjection` dep consumed by
 * pose-transform actions (move, resize, nudge, flip).
 *
 * When the prop is absent (`undefined`), calling this hook with `undefined`
 * registers a source that returns `undefined`, which is indistinguishable from
 * no registration — actions treat a missing dep as "no geometry rewrite".
 * The canonical usage is to mount a `<GeometryProjectionRegistrar>` only when
 * the consumer has supplied a projection, which avoids registering at all.
 *
 * @see GeometryProjection — the dep schema entry.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { GeometryProjection } from 'interactions/actions/geometryProjection';

export function useGeometryProjection(
  projection: GeometryProjection | undefined,
): void {
  const ref = useRef(projection);
  ref.current = projection;
  useDepSource('geometryProjection', () => ref.current);
}
