// apps/site/demos/platformer/skin.ts
import { polygonFromPoints, rectPath, textCommandFromRuns } from '@weasel-js/core';
import type { Dims, DrawCommand, View } from '@weasel-js/core';
import { calloutAge, calloutScreenPos, type Callout } from './callouts';
import { worldToScreen } from './camera';

const COLORS = {
  sky: '#1b2536',
  far: '#2b3b55',
  mid: '#35506b',
  near: '#2a4257',
  solid: '#4a6076',
  solidTop: '#6d8aa4',
  oneway: '#8a7159',
  spike: '#c8556c',
  question: '#c9973f',
  questionMark: '#2a1c0d',
  callout: '#f2e6c8',
  coin: '#f2c14e',
  enemy: '#b1594f',
  enemyEye: '#f4e6d2',
  goal: '#6fd08c',
  pole: '#9aa7a0',
  poleBall: '#d8c48a',
  limb: '#e0d3c2',
  torso: '#5fa8d3',
  head: '#e8c9a8',
  hud: '#f0e6d8',
  endingGround: '#000000',
  endingLost: '#8b1113',
  endingWon: '#d8c48a',
  debugPlayer: '#7ee787',
  debugEnemy: '#ff7b72',
} as const;

const solid = (color: string) => ({ fill: 'solid' as const, color });

const rect = (x: number, y: number, w: number, h: number, color: string): DrawCommand => ({
  kind: 'path',
  path: rectPath(x, y, w, h),
  fill: solid(color),
});

export type Band = 'far' | 'mid' | 'near';

const BANDS: Record<Band, { color: string; period: number; height: number; baseline: number }> = {
  far: { color: COLORS.far, period: 420, height: 150, baseline: 210 },
  mid: { color: COLORS.mid, period: 260, height: 110, baseline: 250 },
  near: { color: COLORS.near, period: 170, height: 70, baseline: 290 },
};

/**
 * One band of hills, repeated along x so panning never runs out of scenery.
 * The parallax layer wrapping this supplies an inner view moving at the band's
 * own rate, so this function never knows how fast it is going. `far` also paints
 * the sky, since it is the bottom-most band.
 */
export function drawBackdrop(view: View, dims: Dims, band: Band): DrawCommand[] {
  const { color, period, height, baseline } = BANDS[band];
  const out: DrawCommand[] = band === 'far' ? [rect(0, 0, dims.width, dims.height, COLORS.sky)] : [];
  const horizon = worldToScreen(view, 0, baseline).y;
  const stepPx = period * view.scale.x;
  const originX = worldToScreen(view, 0, 0).x;
  const first = Math.floor(-originX / stepPx) - 1;
  const count = Math.ceil(dims.width / stepPx) + 3;
  for (let i = first; i < first + count; i++) {
    const cx = originX + i * stepPx;
    out.push({
      kind: 'path',
      path: polygonFromPoints([
        { x: cx - (period / 2) * view.scale.x, y: horizon },
        { x: cx, y: horizon - height * view.scale.y },
        { x: cx + (period / 2) * view.scale.x, y: horizon },
      ]),
      fill: solid(color),
    });
  }
  out.push(rect(0, horizon, dims.width, Math.max(0, dims.height - horizon), color));
  return out;
}

/** World units a callout floats upward over its lifetime. */
const CALLOUT_RISE = 18;

/** `now` is on the same clock as each callout's `bornAt`/`ttl` — the demo's
 *  own elapsed-seconds counter, not wall-clock time. */
export function drawCallouts(callouts: Callout[], view: View, dims: Dims, now: number): DrawCommand[] {
  return callouts.map((c) => {
    const u = calloutAge(c, now);
    const pos = calloutScreenPos(c, view, dims);
    const screen = c.anchor.kind === 'screen';
    const style = {
      fontFamily: 'sans-serif',
      fontSize: screen ? 22 : 12,
      align: 'center' as const,
    };
    return {
      kind: 'group' as const,
      alpha: 1 - u,
      children: [textCommandFromRuns(
        pos.x,
        pos.y - u * CALLOUT_RISE,
        [{ text: c.text, fill: solid(COLORS.callout) }],
        style,
      )],
    };
  });
}

/**
 * The ending card. Two ramps rather than one: the ground darkens first and the
 * lettering arrives behind it, which is what makes the beat land instead of
 * reading as a single cross-fade.
 */
export function drawEnding(
  outcome: 'won' | 'lost',
  since: number,
  dims: Dims,
): DrawCommand[] {
  const ramp = (start: number, over: number) =>
    Math.max(0, Math.min((since - start) / over, 1));
  const won = outcome === 'won';
  const text = won ? 'GOAL REACHED' : 'YOU DIED';
  const size = won ? 46 : 60;
  return [
    {
      kind: 'group',
      alpha: ramp(0, 0.55) * 0.78,
      children: [rect(0, 0, dims.width, dims.height, COLORS.endingGround)],
    },
    {
      kind: 'group',
      alpha: ramp(0.25, 0.9),
      children: [
        textCommandFromRuns(
          dims.width / 2,
          0,
          [{ text, fill: solid(won ? COLORS.endingWon : COLORS.endingLost) }],
          {
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: size,
            align: 'center',
            letterSpacing: size * 0.14,
          },
          undefined,
          dims.height,
          'center',
        ),
      ],
    },
  ];
}

export { COLORS };
