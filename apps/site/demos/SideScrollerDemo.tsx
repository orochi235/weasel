import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  blur,
  deriveParallaxView,
  rectPath,
  resolveSkeleton,
  textCommandFromRuns,
  useAnimator,
  useScene,
} from '@weasel-js/core';
import type { Dims, DrawCommand, Effect, LayerGroup, RenderLayer, View } from '@weasel-js/core';
import { CAM_SCALE, cameraView, followCamera, worldToScreen } from './platformer/camera';
import { WORLD } from './platformer/worldLevel';
import { COLORS, drawBackdrop, drawCallouts, drawCoins, drawEnding, drawEnemies, drawGoal, drawPlayer, drawTiles } from './platformer/skin';
import { flagY } from './platformer/flagpole';
import { BODY_H, BODY_W } from './platformer/physics';
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
} from './platformer/world';
import { PLAYER_SKELETON } from './platformer/skeleton';
import { usePlatformerInput } from './platformer/useInput';
import { usePlatformerAudio } from './platformer/usePlatformerAudio';

const W = 720;
const H = 405;
const DIMS: Dims = { width: W, height: H };
/** The canvas view never moves — every layer projects through the camera ref
 *  itself, which keeps the whole game loop out of React state. */
const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
/** The concussion blur's envelope, in ms, and the radius it peaks at. Rise and
 *  fall rather than a step: a blur that snaps on reads as a dropped frame. */
const BONK_BLUR = { rise: 120, hold: 260, fall: 200, radius: 6 };

/** Peak radius `hold` ms after the knock, nothing before it or long after. */
function bonkBlurRadius(since: number): number {
  const { rise, hold, fall, radius } = BONK_BLUR;
  if (since < 0 || since > rise + hold + fall) return 0;
  if (since < rise) return radius * (since / rise);
  const out = since - rise - hold;
  return out <= 0 ? radius : radius * (1 - out / fall);
}

/** The layers the blur runs over: everything the camera frames, and nothing
 *  the player reads. They are consecutive in the stack below, so the kit draws
 *  them into one buffer and blurs that — `blur(world)`, not six blurs stacked. */
const WORLD_LAYERS = [
  'backdrop-far', 'backdrop-mid', 'backdrop-near', 'tiles', 'entities', 'player',
];

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

  // The debug layer's `draw` runs outside React, so the checkbox mirrors its
  // state into a ref rather than closing over `showBoxes` directly.
  const [showBoxes, setShowBoxes] = useState(false);
  const showBoxesRef = useRef(false);
  useEffect(() => {
    showBoxesRef.current = showBoxes;
  }, [showBoxes]);

  // When the last head knock landed. A ref, not state: the effect chain is
  // re-read on every frame the canvas paints, so the fade costs no render.
  const bonkAt = useRef(-Infinity);
  const pulseBlur = () => {
    bonkAt.current = performance.now();
  };

  const layerGroups = useMemo<LayerGroup[]>(() => [{
    id: 'world',
    layers: WORLD_LAYERS,
    effects: (): Effect[] => {
      const radius = bonkBlurRadius(performance.now() - bonkAt.current);
      // No passes between knocks, so the offscreen buffer is never allocated.
      return radius > 0 ? blur({ radius }) : [];
    },
  }], []);

  const sound = usePlatformerAudio(animator, pulseBlur);

  // Readouts refresh at 5 Hz, not per frame — polling here keeps the panel
  // itself from becoming part of the load it's measuring.
  const [stats, setStats] = useState({ frame: 0, voices: 0, steps: 0, spread: 0 });
  const frameMs = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStats({ frame: frameMs.current, ...sound.stats() });
    }, 200);
    return () => window.clearInterval(id);
  }, []);

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
      sound.beginFrame(g);

      // Simulation halts on pause and once the run is decided.
      if (g.outcome !== 'playing') stepEnding(g, frame, sound.hooks.current);
      const simulating = running && g.outcome === 'playing';
      if (simulating) advanceWorld(g, frame, input, sound.hooks.current);
      sound.endFrame(g, simulating);
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
    sound.swarm(extra);
  };

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
        <button className="ckd-btn" onClick={sound.enableAudio} disabled={sound.audioState === 'running'}>
          {sound.audioState === 'running' ? 'audio on' : 'enable audio'}
        </button>
        <button className="ckd-btn" onClick={sound.toggleMusic} aria-pressed={sound.musicOn}>
          {sound.musicOn ? 'music off' : 'music on'}
        </button>
        <button className="ckd-btn" onClick={restart}>restart</button>
        <span className="ckd-readout">zoom {CAM_SCALE}x</span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectionMode="none"
        animator={animator}
        view={IDENTITY_VIEW}
        layerGroups={layerGroups}
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
