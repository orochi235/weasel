export type { SharedAnchor, CurveRepKind, CurveRepresentation, Discriminator } from './types';
export { bezierCubic } from './bezierCubic';
export { bezierQuadratic } from './bezierQuadratic';
export { nurbs } from './nurbs';
export { spiro } from './spiro';

import { bezierCubic } from './bezierCubic';
import { bezierQuadratic } from './bezierQuadratic';
import { nurbs } from './nurbs';
import { spiro } from './spiro';
import type { CurveRepresentation, CurveRepKind } from './types';

export const CURVE_REPS: Readonly<Record<CurveRepKind, CurveRepresentation>> = {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
};
