import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { segmentAt } from './anchorHandles';
import { eulerCurvatureAt, eulerPointAt } from '../paths/eulerSpiral';
import { SPIRO_KINDS, solveSpiro, type SpiroPoint, type SpiroSegment } from '../paths/spiro';
import { spiroToPath } from '../paths/spiroPath';

const pointsOf = (anchors: SharedAnchor[]): SpiroPoint[] =>
  anchors.map((a) => ({ x: a.x, y: a.y, kind: a.spiroType ?? 'smooth' }));

/** The solved segment `t` falls in, and how far along it. */
function locate(anchors: SharedAnchor[], t: number): { seg: SpiroSegment; s: number } {
  const { segIdx, localT } = segmentAt(anchors, t);
  return { seg: solveSpiro(pointsOf(anchors), false)[segIdx], s: localT };
}

/** Spiro (κ-curves): curvature-continuous through each smooth anchor, so joins stay visually smooth without hand-tuned handles. Solved with `solveSpiro`, and written as cubics by `spiroToPath`. */
export const spiro: CurveRepresentation = {
  kind: 'spiro',
  label: 'Spiro (κ-curves)',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { seg, s } = locate(anchors, t);
    if (seg.spiral) return eulerPointAt(seg.spiral, s);
    return { x: seg.from.x + (seg.to.x - seg.from.x) * s, y: seg.from.y + (seg.to.y - seg.from.y) * s };
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    return spiroToPath([{ points: pointsOf(anchors), closed: false }]).path;
  },
  curvatureAt(anchors, t) {
    if (anchors.length < 2) return 0;
    const { seg, s } = locate(anchors, t);
    return seg.spiral ? eulerCurvatureAt(seg.spiral, s) : 0;
  },
  discriminators(anchors) {
    const out: Discriminator[] = [];
    for (let i = 0; i < anchors.length; i++) {
      out.push({
        kind: 'enum',
        label: `t${i}`,
        anchorIndex: i,
        field: 'spiroType',
        options: SPIRO_KINDS,
        value: anchors[i].spiroType ?? 'smooth',
      });
    }
    return out;
  },
};
