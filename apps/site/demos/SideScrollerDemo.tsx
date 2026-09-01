import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  deriveParallaxView,
  rectPath,
  resolveSkeleton,
  textCommandFromRuns,
  useAnimator,
  useScene,
} from '@weasel-js/core';
import type { Dims, DrawCommand, RenderLayer, TimelineHandle, View } from '@weasel-js/core';
import { createAudioEngine } from '@weasel-js/audio';
import type { AudioEngine, SoundHandle, VoiceHandle } from '@weasel-js/audio';
import { CAM_SCALE, cameraView, followCamera, worldToScreen } from './platformer/camera';
import { WORLD } from './platformer/worldLevel';
import { COLORS, drawBackdrop, drawCallouts, drawCoins, drawEnding, drawEnemies, drawGoal, drawPlayer, drawTiles } from './platformer/skin';
import { flagY } from './platformer/flagpole';
import { BODY_H, BODY_W, MOVE_SPEED } from './platformer/physics';
import { resolvePose } from './platformer/animState';
import { createEnemies, ENEMY_H, ENEMY_W } from './platformer/entities';
import {
  advanceWorld,
  freshGame,
  POLE,
  stepEnding,
  SHAKE_DURATION,
  SHAKE_MAGNITUDE,
  type GameRefs,
  type WorldHooks,
} from './platformer/world';
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
/** Footfalls are placed this far after their true crossing, so the frame that
 *  happened to notice a contact stops deciding when it sounds. */
const STEP_SCHEDULE_BUDGET_MS = 16;

/** How long the blur holds after a head knock before fading back out. */
const BONK_BLUR_MS = 260;

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
  const restart = () => {
    game.current = freshGame();
    setNonce((n) => n + 1);
  };

  const audio = useRef<{ engine: AudioEngine; sounds: Record<SoundName, SoundHandle>; bed: VoiceHandle | null } | null>(null);
  const [audioState, setAudioState] = useState<'off' | 'suspended' | 'running'>('off');
  const [musicOn, setMusicOn] = useState(true);

  // The debug layer's `draw` runs outside React, so the checkbox mirrors its
  // state into a ref rather than closing over `showBoxes` directly.
  const [showBoxes, setShowBoxes] = useState(false);
  const showBoxesRef = useRef(false);
  useEffect(() => {
    showBoxesRef.current = showBoxes;
  }, [showBoxes]);

  // A class toggle rather than a computed filter value; the CSS transition does
  // the fade in both directions, so this only has to say when to let go.
  const [blurred, setBlurred] = useState(false);
  const blurTimer = useRef(0);
  const pulseBlur = () => {
    setBlurred(true);
    window.clearTimeout(blurTimer.current);
    blurTimer.current = window.setTimeout(() => setBlurred(false), BONK_BLUR_MS);
  };
  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  // The run cycle's own timeline — its playhead is what fires footsteps, not
  // the fixed-step loop. `runScale` is what the loop writes and the footstep
  // handler reads back to know the interval a given tick implies.
  /** Frames left before the music stops; -1 once it has. */
  const cutMusicIn = useRef(-1);
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
        engine.bus('music').mute(!musicOn);
        audio.current!.bed = engine.play(audio.current!.sounds.bed, { bus: 'music', loop: true, gain: 0.5 });
      }
    });
  };

  /** The bed is the only sound that runs on its own — everything else is a
   *  one-shot that stops when you do — so it gets a switch of its own. */
  const toggleMusic = () => {
    const next = !musicOn;
    audio.current?.engine.bus('music').mute(!next);
    setMusicOn(next);
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
        footstepTrack((_authoredT, lateBy) => {
          const a = audio.current;
          const s = stepStats.current;
          const scale = runScale.current;
          // `lateBy` is timeline ms; the wall-clock span it stands for shrinks
          // as the run cycle speeds up.
          const lateWall = lateBy / Math.max(scale, 0.01);
          const crossedAt = performance.now() - lateWall;
          // While the player is still accelerating, the scale at this footfall
          // differs from the one recorded at the last — skip those pairs so the
          // spread reflects steady-state scheduling, not a changing run speed.
          if (s.lastAt && Math.abs(scale - s.lastScale) <= JITTER_SCALE_TOLERANCE) {
            const gap = crossedAt - s.lastAt;
            const expected = (CLIPS.run.duration / 2) / Math.max(scale, 0.01);
            s.spread = Math.max(s.spread, Math.abs(gap - expected));
          }
          s.lastAt = crossedAt;
          s.lastScale = scale;
          s.count++;
          if (!a || a.engine.state() !== 'running') return;
          // A frame longer than the budget lands in the past and plays at once,
          // which is what every footfall did before `lateBy` existed.
          a.engine.play(a.sounds.step, {
            bus: 'sfx',
            gain: 0.35,
            when: a.engine.now() + STEP_SCHEDULE_BUDGET_MS - lateWall,
          });
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

  // Rebuilt every render so the callbacks it forwards are never stale; the
  // loop reads it through the ref, which `advanceWorld` calls per fixed step.
  const hooks = useRef<WorldHooks>(null!);
  hooks.current = {
    sound: fire,
    soundAt: (name, at, gain) => fireAt(name, at, gain),
    duck: duckMusic,
    bonk: pulseBlur,
    flagImpact: () => {
      fire('hurt', 0.9);
      pulseBlur();
      // Cut the bed a couple of frames later, so the thwack lands into silence.
      cutMusicIn.current = 2;
    },
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
    // nearly keep up. `createParallaxLayer` wraps source RenderLayers; these
    // bands draw immediately, like `tiles` below, so they call the derive
    // helper themselves against the camera ref.
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
          ...drawGoal(POLE, flagY(POLE, g.slide?.y ?? null), v),
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
        const style = { fontFamily: 'sans-serif', fontSize: 14 };
        const paint = { fill: 'solid' as const, color: COLORS.hud };
        const out: DrawCommand[] = [
          textCommandFromRuns(12, 22, [{ text: `♥ ${Math.max(g.lives, 0)}`, fill: paint }], style),
          textCommandFromRuns(72, 22, [{ text: `◆ ${g.score} / ${g.coins.length}`, fill: paint }], style),
          textCommandFromRuns(190, 22, [{ text: `${g.elapsed.toFixed(1)}s`, fill: paint }], style),
        ];
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

    const ending: RenderLayer<unknown> = {
      id: 'ending',
      label: 'Ending',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        return g.outcome === 'playing' ? [] : drawEnding(g.outcome, g.ended, DIMS);
      },
    };

    return { bands, tiles, entities, player, debug, hud, callouts, ending };
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
      if (g.outcome !== 'playing') stepEnding(g, frame, hooks.current);

      if (cutMusicIn.current >= 0 && cutMusicIn.current-- === 0) {
        audio.current?.bed?.stop(40);
      }

      if (!running || g.outcome !== 'playing') {
        const cycle = runCycle.current;
        if (cycle && !cycle.isPaused()) cycle.pause();
        return;
      }

      advanceWorld(
        g,
        frame,
        () => ({
          left: input.current.left,
          right: input.current.right,
          jumpHeld: input.current.jumpHeld,
          jumpPressed: consumeJumpPress(input),
        }),
        hooks.current,
      );

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

  const canvasClassName = blurred ? 'ckd-canvas ckd-canvas--knocked' : 'ckd-canvas';

  return (
    // `SceneCanvas` forwards no `onFocus`, but focus events bubble — so catch it
    // here and filter to the canvas, or tabbing to a toolbar button would start
    // the game too.
    <div
      className="ckd-demo"
      onFocus={(e) => {
        if ((e.target as HTMLElement).tagName === 'CANVAS') setRunning(true);
      }}
    >
      <div className="ckd-toolbar">
        <button className="ckd-btn ckd-btn--text" onClick={() => setRunning((r) => !r)}>
          {running ? 'click to pause' : 'click to start'}
        </button>
        <button className="ckd-btn" onClick={enableAudio} disabled={audioState === 'running'}>
          {audioState === 'running' ? 'audio on' : 'enable audio'}
        </button>
        <button className="ckd-btn" onClick={toggleMusic} aria-pressed={musicOn}>
          {musicOn ? 'music off' : 'music on'}
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
          backdropFar: { layer: layers.bands[0], after: 'grid' },
          backdropMid: { layer: layers.bands[1], after: 'backdropFar' },
          backdropNear: { layer: layers.bands[2], after: 'backdropMid' },
          tiles: { layer: layers.tiles, after: 'backdropNear' },
          entities: { layer: layers.entities, after: 'tiles' },
          player: { layer: layers.player, after: 'entities' },
          debug: { layer: layers.debug, after: 'player' },
          hud: { layer: layers.hud, after: 'debug' },
          ending: { layer: layers.ending, after: 'hud' },
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
        A platformer built as a load test for the animation timeline and the audio
        engine. Everything is drawn by custom render layers; the scene graph is off.
      </div>
    </div>
  );
}
