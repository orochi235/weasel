/**
 * The port-curve rule in the 2D kernel's currency: loose scalars, the way
 * `cubicEvalAt` and `applyToPoint` take them. The rule itself lives in
 * `./portCurve`, stated once over components, so this and `./3d` cannot drift.
 */

import {
  PORT_REACH,
  portControls as portControlsN,
  portCurvePoints as portCurvePointsN,
} from './portCurve';

export { PORT_REACH };

/**
 * `[c1, c2]` for the cubic from `(ax, ay)` to `(bx, by)`.
 *
 * A null normal falls back to a lerp along the chord. See `./portCurve` for why
 * the two ends are not symmetric.
 */
export function portControls(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  outNormal: readonly [number, number] | null | undefined,
  inNormal: readonly [number, number] | null | undefined,
  reach: number = PORT_REACH,
): [[number, number], [number, number]] {
  const [c1, c2] = portControlsN([ax, ay], [bx, by], outNormal, inNormal, reach);
  return [
    [c1[0]!, c1[1]!],
    [c2[0]!, c2[1]!],
  ];
}

/** A port curve sampled into `samples` points, excluding its start. */
export function portCurvePoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  outNormal: readonly [number, number] | null | undefined,
  inNormal: readonly [number, number] | null | undefined,
  samples: number,
  reach: number = PORT_REACH,
): [number, number][] {
  return portCurvePointsN([ax, ay], [bx, by], outNormal, inNormal, samples, reach).map(
    (p) => [p[0]!, p[1]!],
  );
}
