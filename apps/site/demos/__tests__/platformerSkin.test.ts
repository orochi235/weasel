// apps/site/demos/__tests__/platformerSkin.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSkeleton } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core';
import { cameraView, createCamera, worldToScreen } from '../platformer/camera';
import { parseLevel, TILE } from '../platformer/level';
import { PLAYER_SKELETON, ROOT_TO_FOOT } from '../platformer/skeleton';
import { createCoins, createEnemies } from '../platformer/entities';
import { drawBackdrop, drawCoins, drawEnemies, drawEnding, drawGoal, drawPlayer, drawTiles } from '../platformer/skin';

const DIMS = { width: 640, height: 360 };
const VIEW = cameraView(createCamera({ x: 5 * TILE, y: 3 * TILE }), DIMS);
const LEVEL = parseLevel([
  '..G..',
  '.o.e.',
  '..=..',
  'S....',
  '#^###',
]);

/** Every command in the tree, flattened through groups. */
function flatten(cmds: DrawCommand[]): DrawCommand[] {
  return cmds.flatMap((c) => (c.kind === 'group' ? [c, ...flatten(c.children)] : [c]));
}

describe('skin', () => {
  it('draws one command per visible solid tile and nothing for air', () => {
    const cmds = flatten(drawTiles(LEVEL, VIEW, DIMS));
    // 4 solid tiles (each capped, since row above is air) x2 + 1 spike + 1 one-way: 10 shapes.
    expect(cmds.filter((c) => c.kind === 'path').length).toBe(10);
  });

  it('culls tiles outside the view', () => {
    const wide = parseLevel([`${'#'.repeat(400)}`]);
    const all = flatten(drawTiles(wide, VIEW, DIMS)).filter((c) => c.kind === 'path').length;
    expect(all).toBeLessThan(60);
    expect(all).toBeGreaterThan(0);
  });

  it('draws a bone group for every joint', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    const cmds = drawPlayer(joints, VIEW, { x: 100, y: 100 }, 1, false);
    expect(flatten(cmds).filter((c) => c.kind === 'group').length).toBeGreaterThanOrEqual(11);
  });

  it('places the rig so the feet, not the hip, land at the requested position', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    const at = { x: 100, y: 100 };
    const [outer] = drawPlayer(joints, VIEW, at, 1, false);
    expect(outer.kind).toBe('group');
    const expectedY = worldToScreen(VIEW, at.x, at.y - ROOT_TO_FOOT).y;
    expect((outer as { transform: Float32Array }).transform[7]).toBeCloseTo(expectedY, 5);
  });

  it('mirrors the player when facing left', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    const right = drawPlayer(joints, VIEW, { x: 100, y: 100 }, 1, false);
    const left = drawPlayer(joints, VIEW, { x: 100, y: 100 }, -1, false);
    expect(JSON.stringify(right)).not.toEqual(JSON.stringify(left));
  });

  it('flashes the player while invulnerable', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    const normal = drawPlayer(joints, VIEW, { x: 100, y: 100 }, 1, false);
    const flashing = drawPlayer(joints, VIEW, { x: 100, y: 100 }, 1, true);
    expect(JSON.stringify(normal)).not.toEqual(JSON.stringify(flashing));
  });

  it('skips dead enemies and taken coins', () => {
    const enemies = createEnemies([{ x: 3.5 * TILE, y: 1.5 * TILE }, { x: 4.5 * TILE, y: 1.5 * TILE }]);
    enemies[1].alive = false;
    const coins = createCoins([{ x: 1.5 * TILE, y: 1.5 * TILE }, { x: 2.5 * TILE, y: 1.5 * TILE }]);
    coins[1].taken = true;
    expect(flatten(drawEnemies(enemies, VIEW)).filter((c) => c.kind === 'path').length).toBeGreaterThan(0);
    const before = flatten(drawCoins(coins, VIEW, 0)).length;
    coins[0].taken = true;
    expect(flatten(drawCoins(coins, VIEW, 0)).length).toBeLessThan(before);
  });

  it('spins a coin over its cycle', () => {
    // 0 and 0.5 are edge-on from opposite sides — a symmetric coin looks the
    // same, so sample a quarter-turn apart instead.
    const coins = createCoins([{ x: 1.5 * TILE, y: 1.5 * TILE }]);
    expect(JSON.stringify(drawCoins(coins, VIEW, 0))).not.toEqual(
      JSON.stringify(drawCoins(coins, VIEW, 0.25)),
    );
  });

  it('draws every backdrop band, and only the far one paints sky', () => {
    for (const band of ['far', 'mid', 'near'] as const) {
      expect(drawBackdrop(VIEW, DIMS, band).length, band).toBeGreaterThan(0);
    }
    // The far band is bottom-most, so it is the one that fills the sky — its
    // wider hill period means fewer triangles, so the counts can tie but far
    // never has fewer.
    expect(drawBackdrop(VIEW, DIMS, 'far').length)
      .toBeGreaterThanOrEqual(drawBackdrop(VIEW, DIMS, 'mid').length);
  });

  it('repeats hills across the whole viewport so panning never runs out', () => {
    const far = drawBackdrop(VIEW, DIMS, 'far').filter((c) => c.kind === 'path');
    expect(far.length).toBeGreaterThan(2);
  });

  it('draws a goal without throwing', () => {
    expect(drawGoal(LEVEL.goal, VIEW, 0).length).toBeGreaterThan(0);
  });
});

describe('drawEnding', () => {
  it('ramps the ground in before the lettering', () => {
    const early = drawEnding('lost', 0.15, DIMS) as never[];
    const [ground, text] = early as unknown as { alpha: number }[];
    expect(ground.alpha).toBeGreaterThan(0);
    // The text ramp starts later, so at 0.15s it is still fully transparent.
    expect(text.alpha).toBe(0);
  });

  it('settles both ramps and stays settled', () => {
    const [ground, text] = drawEnding('lost', 5, DIMS) as unknown as { alpha: number }[];
    expect(ground.alpha).toBeCloseTo(0.78, 5);
    expect(text.alpha).toBe(1);
  });

  it('says YOU DIED on a loss and something else on a win', () => {
    const read = (o: 'won' | 'lost') => {
      const [, group] = drawEnding(o, 5, DIMS) as unknown as { children: { runs: { text: string }[] }[] }[];
      return group.children[0].runs[0].text;
    };
    expect(read('lost')).toBe('YOU DIED');
    expect(read('won')).not.toBe('YOU DIED');
  });

  it('centres the lettering in the viewport with tracking', () => {
    const [, group] = drawEnding('lost', 5, DIMS) as unknown as {
      children: { x: number; height: number; verticalAlign: string; style: { letterSpacing?: number } }[];
    }[];
    const cmd = group.children[0];
    expect(cmd.x).toBe(DIMS.width / 2);
    expect(cmd.height).toBe(DIMS.height);
    expect(cmd.verticalAlign).toBe('center');
    expect(cmd.style.letterSpacing).toBeGreaterThan(0);
  });
});
