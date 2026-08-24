// apps/site/demos/platformer/skin.ts
import { ellipsePath, polygonFromPoints, rectPath, textCommand } from '@weasel-js/core';
import type { Dims, DrawCommand, Mat3, View } from '@weasel-js/core';
import { calloutAge, calloutScreenPos, type Callout } from './callouts';
import { worldToScreen } from './camera';
import { COIN_R, ENEMY_H, ENEMY_W, type Coin, type Enemy } from './entities';
import { ONEWAY, QUESTION, SOLID, SPIKE, TILE, tileAt, toCol, toRow, type Level, type Vec2 } from './level';
import { BONE_LENGTH, BONE_WIDTH, PLAYER_SKELETON, ROOT_TO_FOOT } from './skeleton';

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
  limb: '#e0d3c2',
  torso: '#5fa8d3',
  head: '#e8c9a8',
  hud: '#f0e6d8',
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

export function drawTiles(level: Level, view: View, dims: Dims): DrawCommand[] {
  const out: DrawCommand[] = [];
  const c0 = Math.max(0, toCol(view.x) - 1);
  const c1 = Math.min(level.cols - 1, toCol(view.x + dims.width / view.scale.x) + 1);
  const r0 = Math.max(0, toRow(view.y) - 1);
  const r1 = Math.min(level.rows - 1, toRow(view.y + dims.height / view.scale.y) + 1);
  const s = TILE * view.scale.x;

  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const t = tileAt(level, cx, cy);
      if (t === 0) continue;
      const p = worldToScreen(view, cx * TILE, cy * TILE);
      if (t === SOLID) {
        const capped = tileAt(level, cx, cy - 1) !== SOLID;
        out.push(rect(p.x, p.y, s, s, COLORS.solid));
        if (capped) out.push(rect(p.x, p.y, s, s * 0.16, COLORS.solidTop));
      } else if (t === ONEWAY) {
        out.push(rect(p.x, p.y, s, s * 0.22, COLORS.oneway));
      } else if (t === QUESTION) {
        out.push(rect(p.x, p.y, s, s, COLORS.question));
        out.push(
          // `y` is the top of the text box, not a baseline — centring means
          // handing it the box height and letting verticalAlign do the work.
          textCommand(
            p.x + s / 2,
            p.y,
            '?',
            {
              fontFamily: 'sans-serif',
              fontSize: s * 0.6,
              align: 'center',
              fill: solid(COLORS.questionMark),
            },
            undefined,
            s,
            'center',
          ),
        );
      } else if (t === SPIKE) {
        out.push({
          kind: 'path',
          path: polygonFromPoints([
            { x: p.x, y: p.y + s },
            { x: p.x + s / 2, y: p.y + s * 0.15 },
            { x: p.x + s, y: p.y + s },
          ]),
          fill: solid(COLORS.spike),
        });
      }
    }
  }
  return out;
}

const boneColor = (name: string): string =>
  name === 'torso' || name === 'hip' ? COLORS.torso : name === 'head' ? COLORS.head : COLORS.limb;

/**
 * Each joint's matrix places its bone's local origin, with the bone lying along
 * local +x — so one rect per joint, wrapped in that joint's transform, draws the
 * whole figure. The outer group carries the world→screen placement and the
 * facing mirror, so the rig itself never knows which way the player looks.
 */
export function drawPlayer(
  joints: Map<string, Mat3>,
  view: View,
  at: Vec2,
  facing: 1 | -1,
  flash: boolean,
): DrawCommand[] {
  const p = worldToScreen(view, at.x, at.y - ROOT_TO_FOOT);
  const k = view.scale.x * facing;
  const placement = new Float32Array(9) as Mat3;
  placement[0] = k; placement[1] = 0; placement[2] = 0;
  placement[3] = 0; placement[4] = view.scale.y; placement[5] = 0;
  placement[6] = p.x; placement[7] = p.y; placement[8] = 1;

  const children: DrawCommand[] = [];
  for (const joint of PLAYER_SKELETON.joints) {
    const m = joints.get(joint.name);
    if (!m) continue;
    const len = BONE_LENGTH[joint.name];
    const wid = BONE_WIDTH[joint.name];
    const shape: DrawCommand =
      joint.name === 'head'
        ? { kind: 'path', path: ellipsePath({ x: 0, y: -wid / 2, width: len, height: wid }), fill: solid(COLORS.head) }
        : rect(0, -wid / 2, len, wid, boneColor(joint.name));
    children.push({ kind: 'group', transform: m, children: [shape] });
  }
  return [{ kind: 'group', transform: placement, alpha: flash ? 0.45 : 1, children }];
}

export function drawEnemies(enemies: Enemy[], view: View): DrawCommand[] {
  const out: DrawCommand[] = [];
  for (const e of enemies) {
    if (!e.alive) continue;
    // A shared waddle read at this enemy's own phase offset.
    const squash = 1 + Math.sin(e.phase * 8) * 0.12;
    const w = ENEMY_W * view.scale.x;
    const h = ENEMY_H * squash * view.scale.y;
    const p = worldToScreen(view, e.x, e.y + ENEMY_H / 2);
    out.push({
      kind: 'path',
      path: ellipsePath({ x: p.x - w / 2, y: p.y - h, width: w, height: h }),
      fill: solid(COLORS.enemy),
    });
    const eye = 2.5 * view.scale.x;
    out.push({
      kind: 'path',
      path: ellipsePath({
        x: p.x + Math.sign(e.vx) * w * 0.18 - eye / 2,
        y: p.y - h * 0.7,
        width: eye,
        height: eye,
      }),
      fill: solid(COLORS.enemyEye),
    });
  }
  return out;
}

/** `spin` is 0..1 through the coin's rotation; the ellipse narrows to a line at
 *  the quarter points, which reads as a spinning disc. */
export function drawCoins(coins: Coin[], view: View, spin: number): DrawCommand[] {
  const out: DrawCommand[] = [];
  const w = Math.abs(Math.cos(spin * Math.PI * 2));
  for (const c of coins) {
    if (c.taken) continue;
    const p = worldToScreen(view, c.x, c.y);
    const rx = Math.max(COIN_R * w, 1) * view.scale.x;
    const ry = COIN_R * view.scale.y;
    out.push({
      kind: 'path',
      path: ellipsePath({ x: p.x - rx, y: p.y - ry, width: rx * 2, height: ry * 2 }),
      fill: solid(COLORS.coin),
    });
  }
  return out;
}

export function drawGoal(goal: Vec2, view: View, pulse: number): DrawCommand[] {
  const p = worldToScreen(view, goal.x, goal.y);
  const s = TILE * view.scale.x * (0.7 + 0.1 * Math.sin(pulse * Math.PI * 2));
  return [
    {
      kind: 'path',
      path: polygonFromPoints([
        { x: p.x, y: p.y - s / 2 },
        { x: p.x + s / 2, y: p.y },
        { x: p.x, y: p.y + s / 2 },
        { x: p.x - s / 2, y: p.y },
      ]),
      fill: solid(COLORS.goal),
    },
  ];
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
      fill: solid(COLORS.callout),
    };
    return {
      kind: 'group' as const,
      alpha: 1 - u,
      children: [textCommand(pos.x, pos.y - u * CALLOUT_RISE, c.text, style)],
    };
  });
}

export { COLORS };
