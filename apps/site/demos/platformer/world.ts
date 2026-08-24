// apps/site/demos/platformer/world.ts
import { pushCallout, stepCallouts, type Callout } from './callouts';
import { createCamera, type Camera } from './camera';
import {
  atGoal,
  createCoins,
  createEnemies,
  resolveContacts,
  stepEnemy,
  INVULN,
  type Coin,
  type Enemy,
} from './entities';
import { TILE, type Vec2 } from './level';
import { createBodyState, spikeOverlap, stepBody, STEP, type BodyState, type Input } from './physics';
import { createAnimState, nextAnimState, type AnimState } from './animState';
import type { SoundName } from './sfx';
import { WORLD } from './worldLevel';

/** How long a bonk callout stays up. */
const BONK_CALLOUT_TTL = 0.9;
const COINS_PER_LIFE = 5;
const HEALTHCARE_CALLOUT_TTL = 1.6;
/** Seconds of screen shake after a first or second bonk. */
export const SHAKE_DURATION = 0.25;
/** World units of camera jitter at the shake's peak. */
export const SHAKE_MAGNITUDE = 3;

export interface GameRefs {
  camera: Camera;
  player: BodyState;
  anim: AnimState;
  /** Seconds of remaining invulnerability. */
  invuln: number;
  /** Accumulated real time not yet consumed by a fixed step. */
  accumulator: number;
  enemies: Enemy[];
  coins: Coin[];
  lives: number;
  score: number;
  elapsed: number;
  outcome: 'playing' | 'won' | 'lost';
  /** Seconds of screen shake remaining. */
  shake: number;
  /** Seconds since the run was decided. Its own clock: `elapsed` stops with the
   *  simulation, and the ending needs to keep fading after that. */
  ended: number;
  callouts: Callout[];
}

/**
 * Everything the simulation wants to tell the presentation layer. Each demo
 * supplies its own — audio, blur and shake are rendering concerns, and a
 * headless test passes no-ops.
 */
export interface WorldHooks {
  sound(name: SoundName, gain?: number): void;
  /** A sound with a place in the world, for the engine to spatialize. */
  soundAt(name: SoundName, at: Vec2, gain?: number): void;
  /** Drop the music bed under a hit. */
  duck(): void;
  /** A head knock landed. */
  bonk(): void;
}

export const NO_HOOKS: WorldHooks = {
  sound: () => {},
  soundAt: () => {},
  duck: () => {},
  bonk: () => {},
};

export const freshGame = (): GameRefs => ({
  camera: createCamera(WORLD.spawn),
  player: createBodyState(WORLD.spawn),
  anim: createAnimState(),
  invuln: 0,
  accumulator: 0,
  enemies: createEnemies(WORLD.enemies),
  coins: createCoins(WORLD.coins),
  lives: 3,
  score: 0,
  elapsed: 0,
  outcome: 'playing',
  shake: 0,
  ended: 0,
  callouts: [],
});

/** One fixed step of simulation. Mutates `g` in place. */
export function stepWorld(g: GameRefs, step: Input, hooks: WorldHooks): void {
  g.player = stepBody(g.player, WORLD, step, STEP);
  if (g.player.jumped) hooks.sound('jump', 0.6);
  if (g.player.landed) hooks.sound('land', 0.5);
  g.invuln = Math.max(0, g.invuln - STEP);
  if (spikeOverlap(g.player.body, WORLD) && g.invuln <= 0) {
    g.invuln = INVULN;
    g.player = { ...g.player, body: { ...g.player.body, vy: -300 } };
    hooks.sound('hurt');
    hooks.duck();
  }

  g.elapsed += STEP;
  g.shake = Math.max(0, g.shake - STEP);
  g.callouts = stepCallouts(g.callouts, g.elapsed);

  // A bonk requires the ceiling branch of resolveY to have actually fired
  // this step — walking under a `?` block never sets it.
  if (g.player.bonk && g.outcome === 'playing') {
    const at = { x: (g.player.bonk.cx + 0.5) * TILE, y: (g.player.bonk.cy + 0.5) * TILE };
    g.callouts = pushCallout(g.callouts, {
      text: 'ow',
      anchor: { kind: 'world', at },
      bornAt: g.elapsed,
      ttl: BONK_CALLOUT_TTL,
    });
    hooks.soundAt('hurt', at, 0.7);
    g.shake = SHAKE_DURATION;
    g.lives--;
    g.invuln = INVULN;
    hooks.duck();
    hooks.bonk();
  }

  g.enemies = g.enemies.map((e) => stepEnemy(e, WORLD, STEP));

  for (const hit of resolveContacts(g.player.body, g.enemies, g.coins, g.invuln)) {
    if (hit.kind === 'coin') {
      g.coins[hit.index].taken = true;
      g.score++;
      hooks.sound('coin', 0.5);
      if (g.score % COINS_PER_LIFE === 0) {
        g.lives++;
        g.callouts = pushCallout(g.callouts, {
          text: 'FREE HEALTHCARE',
          anchor: { kind: 'screen' },
          bornAt: g.elapsed,
          ttl: HEALTHCARE_CALLOUT_TTL,
        });
      }
    } else if (hit.kind === 'stomp') {
      const victim = g.enemies[hit.index];
      g.enemies[hit.index].alive = false;
      g.player = { ...g.player, body: { ...g.player.body, vy: -300 } };
      hooks.soundAt('stomp', { x: victim.x, y: victim.y }, 0.7);
    } else {
      g.invuln = INVULN;
      g.lives--;
      g.player = {
        ...g.player,
        body: { ...g.player.body, vy: -280, vx: g.player.body.facing * -120 },
      };
      hooks.sound('hurt');
      hooks.duck();
    }
  }

  // Falling out of the level costs a life and returns to the spawn.
  if (g.player.body.y > WORLD.heightPx + 100) {
    g.lives--;
    g.player = createBodyState(WORLD.spawn);
    g.camera = createCamera(WORLD.spawn);
    g.invuln = INVULN;
    hooks.sound('hurt');
  }

  if (g.lives <= 0 && g.outcome === 'playing') {
    g.outcome = 'lost';
  } else if (atGoal(g.player.body, WORLD.goal) && g.outcome === 'playing') {
    g.outcome = 'won';
    hooks.sound('goal', 0.9);
  }

  g.anim = nextAnimState(
    g.anim,
    {
      onGround: g.player.body.onGround,
      vx: g.player.body.vx,
      vy: g.player.body.vy,
      hurt: g.invuln > INVULN - 0.2,
    },
    STEP,
  );
}

/**
 * Consume `frame` seconds of real time as whole fixed steps. `nextInput` is
 * called once per step rather than once per frame, so a jump press is consumed
 * by exactly one step even when a slow frame runs several.
 */
export function advanceWorld(
  g: GameRefs,
  frame: number,
  nextInput: () => Input,
  hooks: WorldHooks,
): void {
  g.accumulator += frame;
  while (g.accumulator >= STEP) {
    g.accumulator -= STEP;
    stepWorld(g, nextInput(), hooks);
  }
}
