import { pathToCubicContours, type Path } from '@weasel-js/geom';
import { numText } from '@weasel-js/svg/animate';
import type { LottieBezier, LottiePoint } from './types';

const num = (n: number): number => Number(numText(n));

/**
 * `path` as Lottie beziers, one per subpath, every segment a cubic: a quadratic is raised to one,
 * and a straight segment has zero tangents. A closed subpath's closing edge is the bezier's own.
 */
export function lottieShapesOf(path: Path): LottieBezier[] {
  return pathToCubicContours(path).map(({ segs, closed }) => {
    const n = segs.length;
    const v: LottiePoint[] = segs.map(({ c }) => [num(c[0]), num(c[1])]);
    if (!closed) v.push([num(segs[n - 1].c[6]), num(segs[n - 1].c[7])]);
    const i: LottiePoint[] = v.map((): LottiePoint => [0, 0]);
    const o: LottiePoint[] = v.map((): LottiePoint => [0, 0]);
    segs.forEach(({ c, line }, k) => {
      if (line) return;
      const end = (k + 1) % v.length;
      o[k] = [num(c[2] - c[0]), num(c[3] - c[1])];
      i[end] = [num(c[4] - c[6]), num(c[5] - c[7])];
    });
    return { c: closed, v, i, o };
  });
}
