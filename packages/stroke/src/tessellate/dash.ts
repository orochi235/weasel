import type { Polyline } from '@weasel-js/geom/tessellate';

/**
 * Split a polyline into open sub-polylines for the "on" portions of a dash
 * pattern. Each output sub-polyline gets caps from the stroke's `cap` setting.
 * The "off" portions become invisible gaps. Anchor params are carried through:
 * sub-polyline endpoints inherit their source polyline-point's anchor params;
 * dash boundaries that land mid-segment (between two polyline points) snap
 * their anchor params to whichever endpoint they're closer to when the
 * segment crosses a path-anchor boundary, otherwise interpolate `t` linearly.
 */
export function splitForDash(pl: Polyline, dash: number[]): Polyline[] {
  const out: Polyline[] = [];
  const plA = pl.anchorA ?? new Uint32Array(pl.points.length / 2);
  const plB = pl.anchorB ?? new Uint32Array(pl.points.length / 2);
  const plT = pl.anchorT ?? new Float32Array(pl.points.length / 2);

  let dashIdx = 0;
  let dashRemaining = dash[0];
  let onPhase = true;
  let curPts: number[] | null = onPhase ? [pl.points[0], pl.points[1]] : null;
  let curA: number[] | null = onPhase ? [plA[0]] : null;
  let curB: number[] | null = onPhase ? [plB[0]] : null;
  let curT: number[] | null = onPhase ? [plT[0]] : null;

  const flushAndAdvance = () => {
    if (curPts && curPts.length >= 4) {
      out.push({
        points: curPts,
        closed: false,
        anchorA: new Uint32Array(curA!),
        anchorB: new Uint32Array(curB!),
        anchorT: new Float32Array(curT!),
      });
    }
    curPts = null; curA = null; curB = null; curT = null;
    dashIdx = (dashIdx + 1) % dash.length;
    dashRemaining = dash[dashIdx];
    onPhase = !onPhase;
  };

  let prevX = pl.points[0], prevY = pl.points[1];
  const ptCount = pl.points.length / 2;
  const segCount = pl.closed ? ptCount : ptCount - 1;

  for (let i = 0; i < segCount; i++) {
    const nextIdx = (i + 1) % ptCount;
    const cx = pl.points[nextIdx * 2], cy = pl.points[nextIdx * 2 + 1];
    const startA = plA[i], startB = plB[i], startT = plT[i];
    const endA = plA[nextIdx], endB = plB[nextIdx], endT = plT[nextIdx];
    const segFullDx = cx - prevX, segFullDy = cy - prevY;
    const segFullLen = Math.hypot(segFullDx, segFullDy);
    let segDx = segFullDx, segDy = segFullDy;
    let segLen = segFullLen;
    let traveled = 0;

    while (segLen > 1e-9) {
      if (segLen <= dashRemaining) {
        if (onPhase && curPts) {
          curPts.push(cx, cy);
          curA!.push(endA); curB!.push(endB); curT!.push(endT);
        }
        dashRemaining -= segLen;
        prevX = cx; prevY = cy;
        traveled = segFullLen;
        segLen = 0;
        if (dashRemaining <= 1e-9) {
          flushAndAdvance();
          if (onPhase) {
            curPts = [prevX, prevY];
            curA = [endA]; curB = [endB]; curT = [endT];
          }
        }
      } else {
        const tConsume = dashRemaining / segLen;
        const ix = prevX + segDx * tConsume;
        const iy = prevY + segDy * tConsume;
        traveled += dashRemaining;
        const frac = traveled / segFullLen;
        let mA: number, mB: number, mT: number;
        if (startA === endA && startB === endB) {
          mA = startA; mB = startB;
          mT = startT + (endT - startT) * frac;
        } else {
          // Cross-anchor segment: pick the nearer endpoint's params.
          if (frac < 0.5) { mA = startA; mB = startB; mT = startT; }
          else            { mA = endA; mB = endB; mT = endT; }
        }
        if (onPhase && curPts) {
          curPts.push(ix, iy);
          curA!.push(mA); curB!.push(mB); curT!.push(mT);
        }
        prevX = ix; prevY = iy;
        segDx = cx - prevX; segDy = cy - prevY;
        segLen = Math.hypot(segDx, segDy);
        flushAndAdvance();
        if (onPhase) {
          curPts = [prevX, prevY];
          curA = [mA]; curB = [mB]; curT = [mT];
        }
      }
    }
  }

  if (curPts && curPts.length >= 4) {
    const tail: Polyline = {
      points: curPts,
      closed: false,
      anchorA: new Uint32Array(curA!),
      anchorB: new Uint32Array(curB!),
      anchorT: new Float32Array(curT!),
    };
    // A closed subpath's walk ends at the vertex it started from, so the run
    // still open there and the run that started there are one dash. Pushed
    // separately they are two butt-capped ribbons meeting at the seam — the
    // visible artifact whenever the pattern doesn't divide the perimeter.
    const tx = curPts[curPts.length - 2], ty = curPts[curPts.length - 1];
    const meets = (x: number, y: number) => Math.hypot(tx - x, ty - y) <= 1e-9;
    if (pl.closed && out.length > 0 && meets(out[0].points[0], out[0].points[1])) {
      out[0] = joinAtSeam(tail, out[0]);
    } else if (pl.closed && out.length === 0 && meets(curPts[0], curPts[1])) {
      // Every gap fell outside the perimeter: the dash is the whole loop, and
      // a loop stroked as an open run seams at its own start vertex too.
      out.push({
        points: curPts.slice(0, -2),
        closed: true,
        anchorA: tail.anchorA!.slice(0, -1),
        anchorB: tail.anchorB!.slice(0, -1),
        anchorT: tail.anchorT!.slice(0, -1),
      });
    } else {
      out.push(tail);
    }
  }
  return out;
}

/** `tail` continued by `head`, which starts where `tail` ends — the shared
 *  vertex is carried once. */
function joinAtSeam(tail: Polyline, head: Polyline): Polyline {
  return {
    points: [...tail.points, ...head.points.slice(2)],
    closed: false,
    anchorA: Uint32Array.from([...tail.anchorA!, ...head.anchorA!.subarray(1)]),
    anchorB: Uint32Array.from([...tail.anchorB!, ...head.anchorB!.subarray(1)]),
    anchorT: Float32Array.from([...tail.anchorT!, ...head.anchorT!.subarray(1)]),
  };
}
