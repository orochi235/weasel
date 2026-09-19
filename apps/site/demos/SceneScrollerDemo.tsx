import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  blur,
  createParallaxLayer,
  defaultDrawOne,
  rectPath,
  textCommandFromRuns,
  useAnimator,
  useHandTool,
  useScene,
  useTools,
} from '@weasel-js/core';
import type { Dims, DrawCommand, Effect, LayerGroup, RectPose, RenderLayer, SceneCanvasApi } from '@weasel-js/core';
import { CAM_SCALE, cameraView, followCamera } from './platformer/camera';
import { WORLD } from './platformer/worldLevel';
import { COLORS, drawBackdrop, drawCallouts, drawEnding } from './platformer/skin';
import { createEnemies, ENEMY_H, ENEMY_W } from './platformer/entities';
import { BODY_H, BODY_W } from './platformer/physics';
import { usePlatformerAudio } from './platformer/usePlatformerAudio';
import { usePlatformerInput } from './platformer/useInput';
import {
  boneNodes,
  entityNodes,
  flagpoleNodes,
  syncScene,
  tileNodes,
  type WorldData,
  type WorldLayer,
} from './platformer/sceneWorld';
import {
  advanceWorld,
  freshGame,
  POLE,
  SHAKE_DURATION,
  SHAKE_MAGNITUDE,
  stepEnding,
  type GameRefs,
} from './platformer/world';

const W = 720;
const H = 405;
const DIMS: Dims = { width: W, height: H };

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

export function SceneScrollerDemo() {
  const [run, setRun] = useState(0);
  return (
    <WeaselProvider>
      {/* Remounting is the restart: the scene's initial node set is the level. */}
      <SceneScrollerDemoInner key={run} onRestart={() => setRun((n) => n + 1)} />
    </WeaselProvider>
  );
}

function SceneScrollerDemoInner({ onRestart }: { onRestart: () => void }) {
  const animator = useAnimator();
  const input = usePlatformerInput();
  const game = useRef<GameRefs>(freshGame());

  const scene = useScene<WorldData, WorldLayer, RectPose>({
    systemLayers: [{ id: 'tiles' }, { id: 'entities' }, { id: 'player' }],
    initial: useMemo(
      () => [
        ...tileNodes(WORLD),
        ...entityNodes(game.current.coins, game.current.enemies),
        ...flagpoleNodes(POLE),
        ...boneNodes(),
      ],
      [],
    ),
    // The loop rewrites poses every frame; re-rendering this component for
    // each of those writes would undo the point of the imperative camera.
    subscribe: false,
  });

  // A minimal registry so SceneCanvas doesn't auto-mount select/resize/rotate:
  // their handle chrome tessellates cubic paths against poses this demo
  // rewrites every frame, and the demo has nothing to select.
  const hand = useHandTool();
  const tools = useTools({ active: 'hand', registry: useMemo(() => ({ hand }), [hand]) });

  const [running, setRunning] = useState(false);
  const canvas = useRef<SceneCanvasApi | null>(null);
  const initialView = useMemo(() => cameraView(game.current.camera, DIMS), []);

  // When the last head knock landed. A ref, not state: the group's effects
  // thunk is re-read on every frame the canvas paints, so the fade costs no render.
  const bonkAt = useRef(-Infinity);
  const sound = usePlatformerAudio(animator, () => {
    bonkAt.current = performance.now();
  });
  const { hooks, beginFrame, endFrame, stats: soundStats } = sound;

  // The world is the three parallax bands and the scene, consecutive in the
  // stack below, so a knock blurs them as one buffer and leaves the HUD sharp.
  // A scene with layers draws as one canvas layer per scene layer, so the group
  // names those rather than the slot.
  const layerGroups = useMemo<LayerGroup[]>(() => [{
    id: 'world',
    layers: ['backdrop-far', 'backdrop-mid', 'backdrop-near', 'scene:tiles', 'scene:entities', 'scene:player'],
    effects: (): Effect[] => {
      const radius = bonkBlurRadius(performance.now() - bonkAt.current);
      // No passes between knocks, so the offscreen buffer is never allocated.
      return radius > 0 ? blur({ radius }) : [];
    },
  }], []);

  // The debug layer's `draw` runs outside React, so the checkbox mirrors its
  // state into a ref rather than closing over `showBoxes` directly.
  const [showBoxes, setShowBoxes] = useState(false);
  const showBoxesRef = useRef(false);
  useEffect(() => {
    showBoxesRef.current = showBoxes;
  }, [showBoxes]);

  const frameMs = useRef(0);
  const [stats, setStats] = useState({ frame: 0, nodes: 0, writes: 0, voices: 0, steps: 0, spread: 0 });
  const writes = useRef(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setStats({ frame: frameMs.current, nodes: scene.nodes.size, writes: writes.current, ...soundStats() }),
      200,
    );
    return () => window.clearInterval(id);
  }, [scene, soundStats]);

  useEffect(() => animator.keepAlive(), [animator]);

  useEffect(() => {
    let last = performance.now();
    return animator.onTick(() => {
      const now = performance.now();
      const frame = Math.min((now - last) / 1000, 0.1);
      last = now;
      frameMs.current = frame * 1000;

      const g = game.current;
      g.camera = followCamera(g.camera, g.player.body, DIMS, WORLD, frame);
      beginFrame(g);

      if (g.outcome !== 'playing') stepEnding(g, frame, hooks.current);
      const simulating = running && g.outcome === 'playing';
      if (simulating) advanceWorld(g, frame, input, hooks.current);
      endFrame(g, simulating);

      // A simulation step is not an edit, so it records nothing: one notify
      // and one repaint per frame, however many nodes moved.
      scene.untracked(() => syncScene(scene, g));
      writes.current++;

      // The camera is the canvas view, so scene nodes and the parallax bands
      // all project through it. A shake nudges the view rather than the
      // camera, keeping the follow state clean.
      const v = cameraView(g.camera, DIMS);
      const shake = g.shake;
      canvas.current?.setView(shake > 0
        ? {
            ...v,
            x: v.x + Math.sin(g.elapsed * 53) * SHAKE_MAGNITUDE * (shake / SHAKE_DURATION),
            y: v.y + Math.cos(g.elapsed * 47) * SHAKE_MAGNITUDE * (shake / SHAKE_DURATION),
          }
        : v);
    });
  }, [animator, running, input, scene, hooks, beginFrame, endFrame]);

  const layers = useMemo(() => {
    const band = (name: 'far' | 'mid' | 'near', pan: number): RenderLayer<unknown> =>
      createParallaxLayer({
        id: `backdrop-${name}`,
        label: `Backdrop ${name}`,
        pan: { x: pan, y: pan * 0.6 },
        source: [{
          id: `backdrop-${name}-src`,
          label: `Backdrop ${name}`,
          space: 'screen',
          draw: (_d, v, dims) => drawBackdrop(v, dims, name),
        }],
      });

    const hud: RenderLayer<unknown> = {
      id: 'hud',
      label: 'HUD',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        const style = { fontFamily: 'sans-serif', fontSize: 14 };
        const paint = { fill: 'solid' as const, color: COLORS.hud };
        return [
          textCommandFromRuns(12, 22, [{ text: `♥ ${Math.max(g.lives, 0)}`, fill: paint }], style),
          textCommandFromRuns(72, 22, [{ text: `◆ ${g.score} / ${g.coins.length}`, fill: paint }], style),
          textCommandFromRuns(190, 22, [{ text: `${g.elapsed.toFixed(1)}s`, fill: paint }], style),
        ];
      },
    };

    // World space, since the camera is the canvas view: the boxes are drawn
    // where the bodies are and the view projects them.
    const debug: RenderLayer<unknown> = {
      id: 'debug',
      label: 'Collision boxes',
      draw: (): DrawCommand[] => {
        if (!showBoxesRef.current) return [];
        const g = game.current;
        const box = (x: number, y: number, w: number, h: number, color: string): DrawCommand => ({
          kind: 'path',
          path: rectPath(x - w / 2, y - h / 2, w, h),
          stroke: { width: 1 / CAM_SCALE, paint: { fill: 'solid', color } },
        });
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
      draw: (_d, v, dims): DrawCommand[] => drawCallouts(game.current.callouts, v, dims, game.current.elapsed),
    };

    const ending: RenderLayer<unknown> = {
      id: 'ending',
      label: 'Ending',
      space: 'screen',
      draw: (_d, _v, dims): DrawCommand[] => {
        const g = game.current;
        return g.outcome === 'playing' ? [] : drawEnding(g.outcome, g.ended, dims);
      },
    };

    return { far: band('far', 0.2), mid: band('mid', 0.45), near: band('near', 0.7), debug, hud, callouts, ending };
  }, []);

  /** Insert forty enemies mid-run — the retained-tree counterpart to the load
   *  test's swarm, exercising node insertion rather than a longer array. */
  const swarm = () => {
    const g = game.current;
    const base = g.enemies.length;
    const extra = createEnemies(
      Array.from({ length: 40 }, (_, i) => ({
        x: g.player.body.x + (i % 20) * 18 - 180,
        y: g.player.body.y - 40,
      })),
    );
    g.enemies = [...g.enemies, ...extra];
    sound.swarm(extra);
    scene.untracked(() => {
      entityNodes([], extra)
        .filter((n) => String(n.id).startsWith('enemy:'))
        .forEach((n, i) => {
          scene.add({ ...n, id: `enemy:${base + i}` as typeof n.id });
        });
    });
  };

  return (
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
        <button className="ckd-btn" onClick={onRestart}>restart</button>
        <span className="ckd-readout">zoom {CAM_SCALE}x</span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectionMode="none"
        animator={animator}
        tools={tools}
        ref={canvas}
        defaultView={initialView}
        layerGroups={layerGroups}
        layers={{
          scene: { drawOne: defaultDrawOne, cull: true },
          far: { layer: layers.far, before: 'scene' },
          mid: { layer: layers.mid, before: 'scene' },
          near: { layer: layers.near, before: 'scene' },
          debug: { layer: layers.debug, after: 'scene' },
          hud: { layer: layers.hud, after: 'debug' },
          callouts: { layer: layers.callouts, after: 'hud' },
          ending: { layer: layers.ending, after: 'callouts' },
          selectionOverlay: null,
        }}
      />
      <div className="ckd-toolbar">
        <label className="ckd-field">
          <input
            type="checkbox"
            checked={showBoxes}
            onChange={(e) => setShowBoxes(e.target.checked)}
          />
          collision boxes
        </label>
        <button className="ckd-btn" onClick={swarm}>swarm +40</button>
        <span className="ckd-readout">frame {stats.frame.toFixed(1)} ms</span>
        <span className="ckd-readout">nodes {stats.nodes}</span>
        <span className="ckd-readout">frames committed {stats.writes}</span>
        <span className="ckd-readout">voices {stats.voices}</span>
        <span className="ckd-readout">footsteps {stats.steps}</span>
        <span className="ckd-readout">steady-state jitter {stats.spread.toFixed(1)} ms</span>
      </div>
      <div className="ckd-hint">
        A platformer built as a load test for the animation timeline, the audio
        engine and the scene graph: every tile, coin, enemy and bone is a scene
        node, and the camera is the canvas view. Arrow keys or WASD to move,
        space to jump.
      </div>
    </div>
  );
}
