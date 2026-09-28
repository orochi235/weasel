// apps/site/demos/platformer/skin.ts
import { createTiledLayer, polygonFromPoints, rectPath, textCommandFromRuns } from '@weasel-js/core';
import type { Dims, DrawCommand, RenderLayer, View } from '@weasel-js/core';
import { calloutAge, calloutScreenPos, type Callout } from './callouts';

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

export const BANDS: Record<Band, { color: string; period: number; height: number; baseline: number }> = {
  far: { color: COLORS.far, period: 420, height: 150, baseline: 210 },
  mid: { color: COLORS.mid, period: 260, height: 110, baseline: 250 },
  near: { color: COLORS.near, period: 170, height: 70, baseline: 290 },
};

/** The sky behind every band, fixed to the screen. */
export function drawSky(dims: Dims): DrawCommand[] {
  return [rect(0, 0, dims.width, dims.height, COLORS.sky)];
}

/**
 * One band of hills in the band's own world units: a single hill and the ground
 * under it, authored once and repeated by the tiled layer. The parallax layer
 * wrapping this supplies the band's view, so it never knows how fast it moves.
 */
export function backdropBand(band: Band): RenderLayer<unknown> {
  const { color, period, height, baseline } = BANDS[band];
  const half = period / 2;
  const cell: RenderLayer<unknown> = {
    id: `backdrop-${band}-cell`,
    label: `Backdrop ${band}`,
    draw: (_d, view, dims) => [
      {
        kind: 'path',
        path: polygonFromPoints([
          { x: -half, y: baseline },
          { x: 0, y: baseline - height },
          { x: half, y: baseline },
        ]),
        fill: solid(color),
      },
      // Reaches a unit into the next copy so neighbors overlap rather than abut,
      // leaving no antialiased seam between them.
      rect(-half, baseline, period + 1, Math.max(0, view.y + dims.height / view.scale.y - baseline), color),
    ],
  };
  return createTiledLayer({
    id: `backdrop-${band}-tiles`,
    label: `Backdrop ${band}`,
    source: [cell],
    period,
    bleed: half,
  });
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
