// apps/site/demos/platformer/sceneWorld.ts
import { asNodeId, mat3, resolveSkeleton } from '@weasel-js/core';
import type { Mat3, NodeId, RectPose, Scene } from '@weasel-js/core';
import { resolvePose } from './animState';
import { COIN_R, ENEMY_H, ENEMY_W, type Coin, type Enemy } from './entities';
import { ONEWAY, QUESTION, SOLID, SPIKE, TILE, tileAt, type Level, type Vec2 } from './level';
import { BONE_LENGTH, BONE_WIDTH, PLAYER_SKELETON, ROOT_TO_FOOT } from './skeleton';
import { COLORS } from './skin';
import type { GameRefs } from './world';
import { WORLD } from './worldLevel';

/** The node payloads this demo uses, all of them shapes the kit's built-in
 *  painters already know how to draw. */
export type WorldData =
  | { shape: 'rect' | 'ellipse'; color: string }
  | { shape: 'polygon'; color: string; sides: number }
  | { text: string; style: Record<string, unknown> };

export type WorldLayer = 'tiles' | 'entities' | 'player';

export interface WorldNodeSpec {
  id: NodeId;
  kind: 'leaf';
  layer: WorldLayer;
  pose: RectPose;
  data: WorldData;
}

const leaf = (id: string, layer: WorldLayer, pose: RectPose, data: WorldData): WorldNodeSpec => ({
  id: asNodeId(id),
  kind: 'leaf',
  layer,
  pose,
  data,
});

export const coinId = (i: number) => asNodeId(`coin:${i}`);
export const enemyId = (i: number) => asNodeId(`enemy:${i}`);
export const enemyEyeId = (i: number) => asNodeId(`enemy:${i}:eye`);

/** Eye diameter, in world units — the immediate-mode skin's `2.5 * scale`. */
const EYE = 2.5;
export const boneId = (name: string) => asNodeId(`bone:${name}`);
export const GOAL_ID = asNodeId('goal');

/** Question-block glyph: `kit:text` anchors on the top of the first line box
 *  and does not forward `verticalAlign`, so the box is nudged instead. */
const QUESTION_FONT = TILE * 0.6;

/**
 * Every tile in the level as its own leaf node. Inserted once and never
 * touched again — which is the whole point of putting them in the scene:
 * their painter output memoizes on `(node, pose, data)` and no frame that
 * leaves them alone pays for them.
 */
export function tileNodes(level: Level): WorldNodeSpec[] {
  const out: WorldNodeSpec[] = [];
  for (let cy = 0; cy < level.rows; cy++) {
    for (let cx = 0; cx < level.cols; cx++) {
      const t = tileAt(level, cx, cy);
      if (t === undefined || t === 0) continue;
      const x = cx * TILE;
      const y = cy * TILE;
      const id = `tile:${cx}:${cy}`;
      if (t === SOLID) {
        out.push(leaf(id, 'tiles', { x, y, width: TILE, height: TILE }, { shape: 'rect', color: COLORS.solid }));
        if (tileAt(level, cx, cy - 1) !== SOLID) {
          out.push(leaf(`${id}:cap`, 'tiles', { x, y, width: TILE, height: TILE * 0.16 }, { shape: 'rect', color: COLORS.solidTop }));
        }
      } else if (t === ONEWAY) {
        out.push(leaf(id, 'tiles', { x, y, width: TILE, height: TILE * 0.22 }, { shape: 'rect', color: COLORS.oneway }));
      } else if (t === QUESTION) {
        out.push(leaf(id, 'tiles', { x, y, width: TILE, height: TILE }, { shape: 'rect', color: COLORS.question }));
        out.push(leaf(`${id}:mark`, 'tiles',
          { x: x + TILE / 2, y: y + (TILE - QUESTION_FONT) / 2 - QUESTION_FONT * 0.12, width: TILE, height: TILE },
          { text: '?', style: { fontFamily: 'sans-serif', fontSize: QUESTION_FONT, align: 'center', fill: { fill: 'solid', color: COLORS.questionMark } } },
        ));
      } else if (t === SPIKE) {
        out.push(leaf(id, 'tiles',
          { x, y: y + TILE * 0.15, width: TILE, height: TILE * 0.85 },
          { shape: 'polygon', color: COLORS.spike, sides: 3 },
        ));
      }
    }
  }
  return out;
}

export function entityNodes(coins: Coin[], enemies: Enemy[], goal: Vec2): WorldNodeSpec[] {
  return [
    ...coins.map((c, i) => leaf(`coin:${i}`, 'entities',
      { x: c.x - COIN_R, y: c.y - COIN_R, width: COIN_R * 2, height: COIN_R * 2 },
      { shape: 'ellipse', color: COLORS.coin })),
    ...enemies.flatMap((e, i) => [
      leaf(`enemy:${i}`, 'entities',
        { x: e.x - ENEMY_W / 2, y: e.y - ENEMY_H / 2, width: ENEMY_W, height: ENEMY_H },
        { shape: 'ellipse', color: COLORS.enemy }),
      leaf(`enemy:${i}:eye`, 'entities',
        { x: e.x, y: e.y, width: EYE, height: EYE },
        { shape: 'ellipse', color: COLORS.enemyEye }),
    ]),
    leaf('goal', 'entities',
      { x: goal.x - TILE / 2, y: goal.y - TILE / 2, width: TILE, height: TILE },
      { shape: 'polygon', color: COLORS.goal, sides: 4 }),
  ];
}

const boneColor = (name: string): string =>
  name === 'torso' || name === 'hip' ? COLORS.torso : name === 'head' ? COLORS.head : COLORS.limb;

/** One node per bone. The rig is a transform hierarchy and the scene tree is
 *  not, so the joints resolve to world matrices and are flattened onto
 *  independent nodes every frame — see the demo's own note. */
export function boneNodes(): WorldNodeSpec[] {
  return PLAYER_SKELETON.joints.map((j) =>
    leaf(`bone:${j.name}`, 'player',
      { x: 0, y: 0, width: BONE_LENGTH[j.name], height: BONE_WIDTH[j.name], rotation: 0 },
      { shape: j.name === 'head' ? 'ellipse' : 'rect', color: boneColor(j.name) }),
  );
}

/** Rig space → world: the root sits at the player's feet, and facing mirrors x. */
function placement(at: Vec2, facing: 1 | -1): Mat3 {
  const m = new Float32Array(9) as Mat3;
  m[0] = facing; m[1] = 0; m[2] = 0;
  m[3] = 0; m[4] = 1; m[5] = 0;
  m[6] = at.x; m[7] = at.y - ROOT_TO_FOOT; m[8] = 1;
  return m;
}

const OFFSCREEN: RectPose = { x: -1e5, y: -1e5, width: 0, height: 0 };

/**
 * Push one frame of simulation state onto the scene. Every write goes through
 * `setPose`/`update`, so this is the retained tree carrying a moving world —
 * the caller wraps it in `scene.batch` to keep it to one history entry and one
 * notify.
 */
export function syncScene(scene: Scene<WorldData, WorldLayer, RectPose>, g: GameRefs): void {
  // Coins spin by narrowing: the ellipse collapses to a line at the quarter
  // points, which is the same read as the immediate-mode version.
  const spin = Math.abs(Math.cos(((g.elapsed % 1.2) / 1.2) * Math.PI * 2));
  g.coins.forEach((c, i) => {
    const id = coinId(i);
    if (!scene.get(id)) return;
    scene.setPose(id, c.taken ? OFFSCREEN : {
      x: c.x - Math.max(COIN_R * spin, 0.5),
      y: c.y - COIN_R,
      width: Math.max(COIN_R * spin, 0.5) * 2,
      height: COIN_R * 2,
    });
  });

  g.enemies.forEach((e, i) => {
    const id = enemyId(i);
    if (!scene.get(id)) return;
    const squash = 1 + Math.sin(e.phase * 8) * 0.12;
    const h = ENEMY_H * squash;
    const bottom = e.y + ENEMY_H / 2;
    scene.setPose(id, e.alive
      ? { x: e.x - ENEMY_W / 2, y: bottom - h, width: ENEMY_W, height: h }
      : OFFSCREEN);
    const eye = enemyEyeId(i);
    if (!scene.get(eye)) return;
    scene.setPose(eye, e.alive
      ? { x: e.x + Math.sign(e.vx) * ENEMY_W * 0.18 - EYE / 2, y: bottom - h * 0.7, width: EYE, height: EYE }
      : OFFSCREEN);
  });

  if (scene.get(GOAL_ID)) {
    const s = TILE * (0.7 + 0.1 * Math.sin(((g.elapsed % 1.6) / 1.6) * Math.PI * 2));
    scene.setPose(GOAL_ID, { x: WORLD.goal.x - s / 2, y: WORLD.goal.y - s / 2, width: s, height: s });
  }

  const joints = resolveSkeleton(PLAYER_SKELETON, resolvePose(g.anim));
  const root = placement(
    { x: g.player.body.x, y: g.player.body.y + g.player.body.h / 2 },
    g.player.body.facing,
  );
  for (const j of PLAYER_SKELETON.joints) {
    const m = joints.get(j.name);
    const id = boneId(j.name);
    if (!m || !scene.get(id)) continue;
    const world = mat3.multiply(root, m);
    const len = BONE_LENGTH[j.name];
    const [ox, oy] = mat3.apply(world, 0, 0);
    const [tx, ty] = mat3.apply(world, len, 0);
    const wid = BONE_WIDTH[j.name];
    scene.setPose(id, {
      x: (ox + tx) / 2 - len / 2,
      y: (oy + ty) / 2 - wid / 2,
      width: len,
      height: wid,
      rotation: Math.atan2(ty - oy, tx - ox),
    });
  }
}
