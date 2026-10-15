import type { CurveRepresentation, Discriminator } from './types';
import { defaultInHandle, defaultOutHandle, segmentAt } from './anchorHandles';
import { PATH_C, PATH_M } from '../commands';
import { cubicPointAt } from '../paths/cubicMath';
import { cubicCurvatureAt } from '../paths/curvature';

/** Cubic bezier: each segment takes two control handles. The familiar pen-tool curve, and what SVG path data stores natively. */
export const bezierCubic: CurveRepresentation = {
  kind: 'bezierCubic',
  label: 'Cubic Bezier',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    return cubicPointAt(a, defaultOutHandle(anchors, segIdx), defaultInHandle(anchors, segIdx), b, localT);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    const cmds: number[] = [PATH_M];
    const xs: number[] = [anchors[0].x, anchors[0].y];
    for (let i = 0; i + 1 < anchors.length; i++) {
      const b = anchors[i + 1];
      const c1 = defaultOutHandle(anchors, i);
      const c2 = defaultInHandle(anchors, i);
      cmds.push(PATH_C);
      xs.push(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    }
    return {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(xs),
      fillRule: 'nonzero',
    };
  },
  curvatureAt(anchors, t) {
    if (anchors.length < 2) return 0;
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    return cubicCurvatureAt(a, defaultOutHandle(anchors, segIdx), defaultInHandle(anchors, segIdx), b, localT);
  },
  discriminators(anchors) {
    const out: Discriminator[] = [];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (a.outHandle || i + 1 < anchors.length) {
        out.push({ kind: 'handle', anchorIndex: i, which: 'out' });
      }
      if (a.inHandle || i > 0) {
        out.push({ kind: 'handle', anchorIndex: i, which: 'in' });
      }
    }
    return out;
  },
};
