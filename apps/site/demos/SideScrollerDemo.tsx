import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  deriveParallaxView,
  rectPath,
  resolveSkeleton,
  textCommand,
  useAnimator,
  useScene,
} from '@weasel-js/core';
import type { Dims, DrawCommand, RenderLayer, TimelineHandle, View } from '@weasel-js/core';
import { createAudioEngine } from '@weasel-js/audio';
import type { AudioEngine, SoundHandle, VoiceHandle } from '@weasel-js/audio';
import { CAM_SCALE, cameraView, createCamera, followCamera, worldToScreen, type Camera } from './platformer/camera';
import { pushCallout, stepCallouts, type Callout } from './platformer/callouts';
import { TILE } from './platformer/level';
import { WORLD } from './platformer/worldLevel';
import { COLORS, drawBackdrop, drawCallouts, drawCoins, drawEnemies, drawGoal, drawPlayer, drawTiles } from './platformer/skin';
import {
  createBodyState,
  spikeOverlap,
  stepBody,
  BODY_H,
  BODY_W,
  STEP,
  MOVE_SPEED,
  type BodyState,
  type Input,
} from './platformer/physics';
import { createAnimState, nextAnimState, resolvePose, type AnimState } from './platformer/animState';
import {
  atGoal,
  createCoins,
  createEnemies,
  resolveContacts,
  stepEnemy,
  ENEMY_H,
  ENEMY_W,
  INVULN,
  type Coin,
  type Enemy,
} from './platformer/entities';
import { PLAYER_SKELETON } from './platformer/skeleton';
import { consumeJumpPress, usePlatformerInput } from './platformer/useInput';
import { registerSounds, type SoundName } from './platformer/sfx';
import { CLIPS } from './platformer/clips';
import { footstepTrack } from './platformer/footsteps';

const W = 720;
const H = 405;
const DIMS: Dims = { width: W, height: H };
/** The canvas view never moves — every layer projects through the camera ref
 *  itself, which keeps the whole game loop out of React state. */
const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
/** A footfall pair spanning a time-scale change is still accelerating, not
 *  steady — the gap would measure speed change, not scheduling jitter. */
const JITTER_SCALE_TOLERANCE = 0.02;

/** Third bonk ends the run. */
const MAX_BONKS = 3;
const BONK_CALLOUT_TTL = 0.9;
const COINS_PER_LIFE = 5;
const HEALTHCARE_CALLOUT_TTL = 1.6;
/** Seconds of screen shake after a first or second bonk. */
const SHAKE_DURATION = 0.25;
/** World units of camera jitter at the shake's peak. */
const SHAKE_MAGNITUDE = 3;

interface GameRefs {
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
  outcome: 'playing' | 'won' | 'lost' | 'concussion';
  /** Ceiling hits on a `?` block; the third ends the run. */
  bonks: number;
  /** Seconds of screen shake remaining. */
  shake: number;
  callouts: Callout[];
}

const freshGame = (): GameRefs => ({
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
  bonks: 0,
  shake: 0,
  callouts: [],
});

/**
 * `usePlatformerInput` registers its action via `useAction`, which no-ops
 * without an `ActionsProvider` above it in the tree — and `<SceneCanvas>`'s
 * own provider is a descendant of this component, not an ancestor. So the
 * hook (and everything that reads its result) has to live inside
 * `<WeaselProvider>`, not alongside it.
 */
export function SideScrollerDemo() {
  return (
    <WeaselProvider>
      <SideScrollerDemoInner />
    </WeaselProvider>
  );
}

function SideScrollerDemoInner() {
  const animator = useAnimator();
  const scene = useScene({ items: [] });
  const input = usePlatformerInput();
  const game = useRef<GameRefs>(freshGame());
  const [running, setRunning] = useState(false);
  const [, setNonce] = useState(0);
  // The canvas HUD is what draws `won`/`lost`, but a concussion blurs the
  // canvas — its message has to live in the DOM instead, which needs this
  // mirrored into React state rather than read straight off `game.current`.
  const [concussed, setConcussed] = useState(false);

  const restart = () => {
    game.current = freshGame();
    setConcussed(false);
    setNonce((n) => n + 1);
  };

  const audio = useRef<{ engine: AudioEngine; sounds: Record<SoundName, SoundHandle>; bed: VoiceHandle | null } | null>(null);
  const [audioState, setAudioState] = useState<'off' | 'suspended' | 'running'>('off');

  // The debug layer's `draw` runs outside React, so the checkbox mirrors its
  // state into a ref rather than closing over `showBoxes` directly.
  const [showBoxes, setShowBoxes] = useState(false);
  const showBoxesRef = useRef(false);
  useEffect(() => {
    showBoxesRef.current = showBoxes;
  }, [showBoxes]);

  // Two discrete blur classes rather than a computed filter value, escalating
  // on a short timer so the concussion reads as a hit landing, not a snap cut.
  const [blurStage, setBlurStage] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    if (!concussed) {
      setBlurStage(0);
      return;
    }
    setBlurStage(1);
    const id = window.setTimeout(() => setBlurStage(2), 180);
    return () => window.clearTimeout(id);
  }, [concussed]);

  // The run cycle's own timeline — its playhead is what fires footsteps, not
  // the fixed-step loop. `runScale` is what the loop writes and the footstep
  // handler reads back to know the interval a given tick implies.
  const runCycle = useRef<TimelineHandle | null>(null);
  const runScale = useRef(1);
  const stepStats = useRef({ count: 0, lastAt: 0, lastScale: 1, spread: 0 });

  // Readouts refresh at 5 Hz, not per frame — polling here keeps the panel
  // itself from becoming part of the load it's measuring.
  const [stats, setStats] = useState({ frame: 0, voices: 0, steps: 0, spread: 0 });
  const frameMs = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStats({
        frame: frameMs.current,
        voices: audio.current?.engine.activeVoices() ?? 0,
        steps: stepStats.current.count,
        spread: stepStats.current.spread,
      });
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  // Built on the unlock gesture, not at mount: jsdom has no AudioContext, and a
  // context created before a gesture starts suspended anyway.
  const enableAudio = () => {
    if (typeof AudioContext === 'undefined') return;
    if (!audio.current) {
      const engine = createAudioEngine({ buses: ['sfx', 'music'], voiceLimit: 24 });
      audio.current = { engine, sounds: registerSounds(engine), bed: null };
    }
    const { engine } = audio.current;
    void engine.unlock().then(() => {
      setAudioState(engine.state() === 'running' ? 'running' : 'suspended');
      if (!audio.current!.bed) {
        audio.current!.bed = engine.play(audio.current!.sounds.bed, { bus: 'music', loop: true, gain: 0.5 });
      }
    });
  };

  useEffect(() => () => {
    audio.current?.engine.dispose();
    audio.current = null;
  }, []);

  useEffect(() => {
    const handle = animator.timeline({
      loop: true,
      autoplay: true,
      tracks: [
        footstepTrack(() => {
          const a = audio.current;
          const now = performance.now();
          const s = stepStats.current;
          const scale = runScale.current;
          // While the player is still accelerating, the scale at this footfall
          // differs from the one recorded at the last — skip those pairs so the
          // spread reflects steady-state scheduling, not a changing run speed.
          if (s.lastAt && Math.abs(scale - s.lastScale) <= JITTER_SCALE_TOLERANCE) {
            const gap = now - s.lastAt;
            const expected = (CLIPS.run.duration / 2) / Math.max(scale, 0.01);
            s.spread = Math.max(s.spread, Math.abs(gap - expected));
          }
          s.lastAt = now;
          s.lastScale = scale;
          s.count++;
          if (!a || a.engine.state() !== 'running') return;
          // `fire()` gave us no crossing time, so "now" is the best available —
          // at frame resolution, not the sample resolution the engine wants.
          a.engine.play(a.sounds.step, { bus: 'sfx', gain: 0.35, when: a.engine.now() });
        }),
      ],
      duration: CLIPS.run.duration,
    });
    runCycle.current = handle;
    handle.pause();
    return () => {
      handle.cancel();
      runCycle.current = null;
    };
  }, [animator]);

  const fire = (name: SoundName, gain = 0.8) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    a.engine.play(a.sounds[name], { bus: 'sfx', gain });
  };

  /** For sounds with a place in the world — the engine spatializes against the
   *  listener set from the player each frame. */
  const fireAt = (name: SoundName, position: { x: number; y: number }, gain = 0.8) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    a.engine.play(a.sounds[name], { bus: 'sfx', gain, position });
  };

  /** A hit drops the music under the hurt sound and brings it back. */
  const duckMusic = () => {
    const a = audio.current;
    if (!a) return;
    a.engine.bus('music').setGain(0.15, 60);
    window.setTimeout(() => a.engine.bus('music').setGain(0.5, 400), 260);
  };

  const layers = useMemo(() => {
    // A bonk's shake jitters every screen-space layer identically by nudging
    // the shared view, not the camera itself — the camera's own follow state
    // stays clean, so the jitter can't accumulate into the actual framing.
    const view = () => {
      const v = cameraView(game.current.camera, DIMS);
      const shake = game.current.shake;
      if (shake <= 0) return v;
      const mag = SHAKE_MAGNITUDE * (shake / SHAKE_DURATION);
      const t = game.current.elapsed;
      return { ...v, x: v.x + Math.sin(t * 53) * mag, y: v.y + Math.cos(t * 47) * mag };
    };

    // Three bands at three rates: far hills at 0.2 crawl, near ones at 0.7
    // nearly keep up. `createParallaxLayer` derives pan from the canvas's own
    // view, which is pinned to identity — so each band derives from the
    // camera ref directly instead, same as `tiles` below.
    const bands = ([
      ['far', 0.2],
      ['mid', 0.45],
      ['near', 0.7],
    ] as const).map(([band, pan]): RenderLayer<unknown> => ({
      id: `backdrop-${band}`,
      label: `Backdrop ${band}`,
      space: 'screen',
      draw: (_d, _v, dims): DrawCommand[] =>
        drawBackdrop(deriveParallaxView(view(), { pan: { x: pan, y: pan * 0.6 } }), dims, band),
    }));

    const tiles: RenderLayer<unknown> = {
      id: 'tiles',
      label: 'Tiles',
      space: 'screen',
      draw: (_d, _v, dims): DrawCommand[] => drawTiles(WORLD, view(), dims),
    };

    const player: RenderLayer<unknown> = {
      id: 'player',
      label: 'Player',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        const joints = resolveSkeleton(PLAYER_SKELETON, resolvePose(g.anim));
        // The rig's root sits at the body's feet, not its center.
        const at = { x: g.player.body.x, y: g.player.body.y + g.player.body.h / 2 };
        return drawPlayer(joints, view(), at, g.player.body.facing, g.invuln > 0 && Math.floor(g.invuln * 12) % 2 === 0);
      },
    };

    const entities: RenderLayer<unknown> = {
      id: 'entities',
      label: 'Entities',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        const v = view();
        return [
          ...drawGoal(WORLD.goal, v, (g.elapsed % 1.6) / 1.6),
          ...drawCoins(g.coins, v, (g.elapsed % 1.2) / 1.2),
          ...drawEnemies(g.enemies, v),
        ];
      },
    };

    const hud: RenderLayer<unknown> = {
      id: 'hud',
      label: 'HUD',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        const style = { fontFamily: 'sans-serif', fontSize: 14, fill: { fill: 'solid' as const, color: COLORS.hud } };
        const out: DrawCommand[] = [
          textCommand(12, 22, `♥ ${Math.max(g.lives, 0)}`, style),
          textCommand(72, 22, `◆ ${g.score} / ${g.coins.length}`, style),
          textCommand(190, 22, `${g.elapsed.toFixed(1)}s`, style),
        ];
        // Concussion's message lives in the DOM instead — the canvas is what
        // gets blurred, so text drawn on it would be unreadable.
        if (g.outcome === 'won' || g.outcome === 'lost') {
          out.push(
            textCommand(W / 2 - 60, H / 2, g.outcome === 'won' ? 'you made it' : 'out of lives', {
              ...style,
              fontSize: 26,
            }),
          );
        }
        return out;
      },
    };

    const debug: RenderLayer<unknown> = {
      id: 'debug',
      label: 'Collision boxes',
      space: 'screen',
      defaultVisible: false,
      draw: (): DrawCommand[] => {
        if (!showBoxesRef.current) return [];
        const g = game.current;
        const v = view();
        const box = (x: number, y: number, w: number, h: number, color: string): DrawCommand => {
          const p = worldToScreen(v, x - w / 2, y - h / 2);
          return {
            kind: 'path',
            path: rectPath(p.x, p.y, w * v.scale.x, h * v.scale.y),
            stroke: { width: 1, paint: { fill: 'solid', color } },
          };
        };
        return [
          box(g.player.body.x, g.player.body.y, BODY_W, BODY_H, COLORS.debugPlayer),
          ...g.enemies.filter((e) => e.alive).map((e) => box(e.x, e.y, ENEMY_W, ENEMY_H, COLORS.debugEnemy)),
        ];
      },
    };

    const callouts: RenderLayer<unknown> = {
      id: 'callouts',
      label: 'Callouts',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        return drawCallouts(g.callouts, view(), DIMS, g.elapsed);
      },
    };

    return { bands, tiles, entities, player, debug, hud, callouts };
  }, []);

  // A camera with nothing to follow still has to run, or the first frame after
  // the player lands snaps instead of easing.
  useEffect(() => animator.keepAlive(), [animator]);

  useEffect(() => {
    let last = performance.now();
    return animator.onTick(() => {
      const now = performance.now();
      // A backgrounded tab hands back a huge delta; clamping stops the
      // accumulator from running hundreds of catch-up steps in one frame.
      const frame = Math.min((now - last) / 1000, 0.1);
      last = now;
      frameMs.current = frame * 1000;

      // Framing is not simulation: the camera and listener update every frame,
      // including the first one and while paused, so the view is never left
      // clamped to the spawn point with the level scrolled off to one side.
      const g = game.current;
      g.camera = followCamera(g.camera, g.player.body, DIMS, WORLD, frame);
      audio.current?.engine.setListener({ x: g.player.body.x, y: g.player.body.y });

      // Simulation halts on pause and once the run is decided; the run cycle's
      // own registration is paused here too, or it keeps firing footsteps
      // after death since the animator ticks it independently of this loop.
      if (!running || g.outcome !== 'playing') {
        const cycle = runCycle.current;
        if (cycle && !cycle.isPaused()) cycle.pause();
        return;
      }

      g.accumulator += frame;
      while (g.accumulator >= STEP) {
        g.accumulator -= STEP;
        const step: Input = {
          left: input.current.left,
          right: input.current.right,
          jumpHeld: input.current.jumpHeld,
          jumpPressed: consumeJumpPress(input),
        };
        g.player = stepBody(g.player, WORLD, step, STEP);
        if (g.player.jumped) fire('jump', 0.6);
        if (g.player.landed) fire('land', 0.5);
        g.invuln = Math.max(0, g.invuln - STEP);
        if (spikeOverlap(g.player.body, WORLD) && g.invuln <= 0) {
          g.invuln = INVULN;
          g.player = { ...g.player, body: { ...g.player.body, vy: -300 } };
          fire('hurt');
          duckMusic();
        }

        g.elapsed += STEP;
        g.shake = Math.max(0, g.shake - STEP);
        g.callouts = stepCallouts(g.callouts, g.elapsed);

        // A bonk requires the ceiling branch of resolveY to have actually fired
        // this step — walking under a `?` block never sets it.
        if (g.player.bonk && g.outcome === 'playing') {
          g.bonks++;
          const at = { x: (g.player.bonk.cx + 0.5) * TILE, y: (g.player.bonk.cy + 0.5) * TILE };
          g.callouts = pushCallout(g.callouts, {
            text: 'ow',
            anchor: { kind: 'world', at },
            bornAt: g.elapsed,
            ttl: BONK_CALLOUT_TTL,
          });
          fireAt('hurt', at, 0.7);
          if (g.bonks >= MAX_BONKS) {
            g.outcome = 'concussion';
            setConcussed(true);
          } else {
            g.shake = SHAKE_DURATION;
          }
        }

        g.enemies = g.enemies.map((e) => stepEnemy(e, WORLD, STEP));

        for (const hit of resolveContacts(g.player.body, g.enemies, g.coins, g.invuln)) {
          if (hit.kind === 'coin') {
            g.coins[hit.index].taken = true;
            g.score++;
            fire('coin', 0.5);
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
            fireAt('stomp', { x: victim.x, y: victim.y }, 0.7);
          } else {
            g.invuln = INVULN;
            g.lives--;
            g.player = {
              ...g.player,
              body: { ...g.player.body, vy: -280, vx: g.player.body.facing * -120 },
            };
            fire('hurt');
            duckMusic();
          }
        }

        // Falling out of the level costs a life and returns to the spawn.
        if (g.player.body.y > WORLD.heightPx + 100) {
          g.lives--;
          g.player = createBodyState(WORLD.spawn);
          g.camera = createCamera(WORLD.spawn);
          g.invuln = INVULN;
          fire('hurt');
        }

        if (g.lives <= 0 && g.outcome === 'playing') {
          g.outcome = 'lost';
        } else if (atGoal(g.player.body, WORLD.goal) && g.outcome === 'playing') {
          g.outcome = 'won';
          fire('goal', 0.9);
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

      const grounded = g.player.body.onGround;
      const speed = Math.abs(g.player.body.vx);
      const cycle = runCycle.current;
      if (cycle) {
        if (grounded && speed > 1) {
          runScale.current = Math.max(speed / MOVE_SPEED, 0.2);
          cycle.setTimeScale(runScale.current);
          if (cycle.isPaused()) cycle.resume();
        } else if (!cycle.isPaused()) {
          cycle.pause();
        }
      }
    });
  }, [animator, running, input]);

  /** Drop forty enemies around the player and fire a one-shot for each, so voice
   *  stealing and the per-frame cost of a crowd both become visible. */
  const swarm = () => {
    const g = game.current;
    const extra = Array.from({ length: 40 }, (_, i) => ({
      x: g.player.body.x + (i % 20) * 18 - 180,
      y: g.player.body.y - 40,
    }));
    g.enemies = [...g.enemies, ...createEnemies(extra)];
    const a = audio.current;
    if (a && a.engine.state() === 'running') {
      extra.forEach((p, i) =>
        a.engine.play(a.sounds.stomp, {
          bus: 'sfx',
          gain: 0.2,
          position: p,
          when: a.engine.now() + i * 15,
        }),
      );
    }
  };

  const canvasClassName =
    blurStage === 0 ? 'ckd-canvas' : blurStage === 1 ? 'ckd-canvas ckd-canvas--blur-1' : 'ckd-canvas ckd-canvas--blur-2';

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <button className="ckd-btn" onClick={() => setRunning((r) => !r)}>
          {running ? 'pause' : 'start'}
        </button>
        <button className="ckd-btn" onClick={enableAudio} disabled={audioState === 'running'}>
          {audioState === 'running' ? 'audio on' : 'enable audio'}
        </button>
        <button className="ckd-btn" onClick={restart}>restart</button>
        <span className="ckd-readout">zoom {CAM_SCALE}x</span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className={canvasClassName}
        scene={scene}
        selectionMode="none"
        animator={animator}
        view={IDENTITY_VIEW}
        layers={{
          backdropFar: { layer: layers.bands[0], before: 'scene' },
          backdropMid: { layer: layers.bands[1], after: 'backdropFar' },
          backdropNear: { layer: layers.bands[2], after: 'backdropMid' },
          tiles: { layer: layers.tiles, after: 'backdropNear' },
          entities: { layer: layers.entities, after: 'tiles' },
          player: { layer: layers.player, after: 'entities' },
          debug: { layer: layers.debug, after: 'player' },
          hud: { layer: layers.hud, after: 'debug' },
          callouts: { layer: layers.callouts, after: 'hud' },
          scene: { drawOne: () => [] },
          selectionOverlay: null,
        }}
      />
      <div className="ckd-toolbar">
        <span className="ckd-readout">frame {stats.frame.toFixed(1)} ms</span>
        <span className="ckd-readout">voices {stats.voices}</span>
        <span className="ckd-readout">footsteps {stats.steps}</span>
        <span className="ckd-readout">steady-state jitter {stats.spread.toFixed(1)} ms</span>
        <label className="ckd-field">
          <input
            type="checkbox"
            checked={showBoxes}
            onChange={(e) => setShowBoxes(e.target.checked)}
          />
          collision boxes
        </label>
        <button className="ckd-btn" onClick={swarm}>swarm +40</button>
      </div>
      <div className="ckd-hint">
        {concussed
          ? 'concussion — three ? blocks to the head ends the run. restart to try again.'
          : 'A platformer built as a load test for the animation timeline and the audio ' +
            'engine. Everything is drawn by custom render layers; the scene graph is off.'}
      </div>
    </div>
  );
}
