/**
 * Schneider (1990, Graphics Gems I) adaptive cubic-Bezier fitter.
 * Given a sequence of sample points, returns a `PolygonPath` whose `C`
 * segments approximate the samples within `errorTolerance` world units.
 *
 * Output shape: an initial `M` to the first sample, followed by N
 * `C` cubic segments. For colinear / two-point inputs, returns a single
 * degenerate cubic. For empty input, returns an empty polygon path.
 *
 * NOTE: Task 4 ships only the API surface + degenerate handling. The
 * full LS / reparameterization / split machinery is added in Tasks 5–7.
 */

import { PathBuilder } from './builder';
import type { PolygonPath } from './types';

export interface SchneiderPoint {
  x: number;
  y: number;
}

export function schneiderFit(
  samples: ReadonlyArray<SchneiderPoint>,
  errorTolerance: number,
): PolygonPath {
  if (samples.length === 0) {
    return {
      kind: 'polygon',
      commands: new Uint8Array(),
      coords: new Float32Array(),
      fillRule: 'nonzero',
    };
  }

  const b = new PathBuilder();
  b.moveTo(samples[0].x, samples[0].y);

  if (samples.length === 1) {
    return b.build();
  }

  if (samples.length === 2) {
    emitStraightCubic(b, samples[0], samples[1]);
    return b.build();
  }

  // Full fit lands in Tasks 5–7. Placeholder: connect each consecutive
  // pair with a straight cubic. This produces a correct (but unsmoothed)
  // output that downstream tests can build on incrementally.
  for (let i = 1; i < samples.length; i++) {
    emitStraightCubic(b, samples[i - 1], samples[i]);
  }
  // Suppress unused warning until Task 5 wires the parameter in.
  void errorTolerance;
  return b.build();
}

function emitStraightCubic(
  b: PathBuilder,
  a: SchneiderPoint,
  c: SchneiderPoint,
): void {
  // cp1 at 1/3 along chord, cp2 at 2/3 — the canonical straight cubic.
  const cp1x = a.x + (c.x - a.x) / 3;
  const cp1y = a.y + (c.y - a.y) / 3;
  const cp2x = a.x + (2 * (c.x - a.x)) / 3;
  const cp2y = a.y + (2 * (c.y - a.y)) / 3;
  b.curveTo(cp1x, cp1y, cp2x, cp2y, c.x, c.y);
}
