import { describe, it, expect } from 'vitest';
import { flagpoleAt, flagY, grabsPole, SLIDE_SPEED } from '../platformer/flagpole';
import { BODY_H, BODY_W, STEP } from '../platformer/physics';
import { freshGame, stepEnding, stepWorld, NO_HOOKS, POLE, type WorldHooks } from '../platformer/world';
import { WORLD } from '../platformer/worldLevel';

const body = (x: number, y: number) => ({
  x, y, w: BODY_W, h: BODY_H, vx: 0, vy: 0, onGround: false, facing: 1 as const,
});

describe('flagpole geometry', () => {
  const pole = flagpoleAt(WORLD.goal);

  it('rises from the goal tile', () => {
    expect(pole.topY).toBeLessThan(pole.baseY);
    expect(pole.x).toBe(WORLD.goal.x);
  });

  it('catches the player anywhere along its length', () => {
    expect(grabsPole(body(pole.x, pole.baseY - 20), pole)).toBe(true);
    expect(grabsPole(body(pole.x, pole.topY + 10), pole)).toBe(true);
  });

  it('does not catch above the ball or past the base', () => {
    expect(grabsPole(body(pole.x, pole.topY - BODY_H), pole)).toBe(false);
    expect(grabsPole(body(pole.x, pole.baseY + BODY_H), pole)).toBe(false);
  });

  it('does not catch from across the level', () => {
    expect(grabsPole(body(pole.x - 200, pole.baseY - 20), pole)).toBe(false);
  });

  it('keeps the flag between the ball and the base', () => {
    expect(flagY(pole, pole.topY - 500)).toBeGreaterThan(pole.topY);
    expect(flagY(pole, pole.baseY + 500)).toBeLessThan(pole.baseY);
  });
});

describe('catching the pole', () => {
  /** Start beside the pole and jump at it. Running the whole level would test
   *  the level, not the flagpole. */
  const runToPole = (hooks = NO_HOOKS) => {
    const g = freshGame();
    g.player = {
      ...g.player,
      body: { ...g.player.body, x: POLE.x - 70, y: POLE.baseY - BODY_H / 2, onGround: true },
    };
    for (let i = 0; i < 400 && g.outcome === 'playing'; i++) {
      stepWorld(g, {
        left: false,
        right: true,
        jumpHeld: true,
        jumpPressed: g.player.body.onGround,
      }, hooks);
    }
    return g;
  };

  it('ends the run and centres the player on the pole', () => {
    const g = runToPole();
    expect(g.outcome).toBe('won');
    expect(g.player.body.x).toBe(POLE.x);
    expect(g.slide).not.toBeNull();
  });

  it('reports the impact once, not every step', () => {
    let impacts = 0;
    const hooks: WorldHooks = { ...NO_HOOKS, flagImpact: () => { impacts++; } };
    const g = runToPole(hooks);
    for (let i = 0; i < 60; i++) stepWorld(g, { left: false, right: true, jumpHeld: false, jumpPressed: false }, hooks);
    expect(impacts).toBe(1);
  });

  it('plays the pole clip while riding it down', () => {
    const g = runToPole();
    stepEnding(g, STEP, NO_HOOKS);
    expect(g.anim.current).toBe('pole');
  });

  it('slides down at a steady rate and stops at the base', () => {
    const g = runToPole();
    const startY = g.slide!.y;
    stepEnding(g, 0.1, NO_HOOKS);
    expect(g.player.body.y - startY).toBeCloseTo(SLIDE_SPEED * 0.1, 4);

    for (let t = 0; t < 5 && !g.slide!.done; t += STEP) stepEnding(g, STEP, NO_HOOKS);
    expect(g.slide!.done).toBe(true);
    expect(g.player.body.y + BODY_H / 2).toBeCloseTo(POLE.baseY, 4);
  });

  it('stays put once the slide is done', () => {
    const g = runToPole();
    for (let t = 0; t < 5 && !g.slide!.done; t += STEP) stepEnding(g, STEP, NO_HOOKS);
    const settled = g.player.body.y;
    stepEnding(g, 1, NO_HOOKS);
    expect(g.player.body.y).toBe(settled);
  });
});
