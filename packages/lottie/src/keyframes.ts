import { lerp } from '@weasel-js/geom';
import { lottieTangentsOf, rounded as num, type Frame } from '@weasel-js/svg/internal';
import type { LottieKeyframe, LottieScalar } from './types';

type Tangents = { o: { x: number; y: number }; i: { x: number; y: number } };
/** A value at a time, and how the span into it moves. */
interface Point { t: number; v: number; into: Tangents | 'hold' }

const LINEAR: Tangents = { o: { x: 0, y: 0 }, i: { x: 1, y: 1 } };

/**
 * The points `frames` lower to: one per key, plus those an easing Lottie has no tangents for is
 * expanded into, held from the span's start and to its end where they start or end inside it.
 */
function pointsOf(frames: readonly Frame[], valueOf: (frame: Frame) => number): Point[] {
  const out: Point[] = [{ t: frames[0].t, v: valueOf(frames[0]), into: 'hold' }];
  for (let k = 1; k < frames.length; k++) {
    const from = frames[k - 1];
    const to = frames[k];
    const [a, b] = [valueOf(from), valueOf(to)];
    const tangents = lottieTangentsOf(to.easing);
    if ('expand' in tangents) {
      const pts = tangents.expand;
      const first = pts[0];
      const last = pts[pts.length - 1];
      const held = [...(first.t > 0 ? [{ t: 0, v: first.v }] : []), ...pts, ...(last.t < 1 ? [{ t: 1, v: last.v }] : [])];
      for (const p of held) out.push({ t: lerp(from.t, to.t, p.t), v: lerp(a, b, p.v), into: LINEAR });
    }
    out.push({ t: to.t, v: b, into: 'expand' in tangents ? LINEAR : 'hold' in tangents ? 'hold' : tangents });
  }
  return out.filter((p, k) => k === 0 || p.t !== out[k - 1].t || p.v !== out[k - 1].v);
}

/**
 * `frames` as a Lottie scalar keyed at `t / 1000 * fps`, each value from `valueOf`. A span into a
 * key at the same time, or into a key that holds, is a hold keyframe.
 */
export function scalarOf(frames: readonly Frame[], valueOf: (frame: Frame) => number, fps: number): LottieScalar {
  const points = pointsOf(frames, valueOf);
  const k = points.map(({ t, v }, n): LottieKeyframe => {
    const at = { t: num((t / 1000) * fps), s: [num(v)] as [number] };
    const next = points[n + 1];
    if (!next) return at;
    if (next.t === t || next.into === 'hold') return { ...at, h: 1 };
    const { o, i } = next.into;
    return { ...at, o: { x: [num(o.x)], y: [num(o.y)] }, i: { x: [num(i.x)], y: [num(i.y)] } };
  });
  return { a: 1, k };
}
