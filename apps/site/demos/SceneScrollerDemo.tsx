import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  createParallaxLayer,
  textCommand,
  useAnimator,
  useHandTool,
  useScene,
  useTools,
} from '@weasel-js/core';
import type { Dims, DrawCommand, RectPose, RenderLayer, View } from '@weasel-js/core';
import { CAM_SCALE, cameraView, followCamera } from './platformer/camera';
import { WORLD } from './platformer/worldLevel';
import { COLORS, drawBackdrop, drawCallouts, drawEnding } from './platformer/skin';
import { createEnemies } from './platformer/entities';
import { consumeJumpPress, usePlatformerInput } from './platformer/useInput';
import {
  boneNodes,
  entityNodes,
  syncScene,
  tileNodes,
  type WorldData,
  type WorldLayer,
} from './platformer/sceneWorld';
import {
  advanceWorld,
  freshGame,
  NO_HOOKS,
  SHAKE_DURATION,
  SHAKE_MAGNITUDE,
  type GameRefs,
} from './platformer/world';

const W = 720;
const H = 405;
const DIMS: Dims = { width: W, height: H };

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
        ...entityNodes(game.current.coins, game.current.enemies, WORLD.goal),
        ...boneNodes(),
      ],
      [],
    ),
    // A frame is one batch, so this is a second of undo — enough to be a real
    // history, short enough that a running game can't grow it without bound.
    historyLimit: 60,
  });

  // A minimal registry so SceneCanvas doesn't auto-mount select/resize/rotate:
  // their handle chrome tessellates cubic paths against poses this demo
  // rewrites every frame, and the demo has nothing to select.
  const hand = useHandTool();
  const tools = useTools({ active: 'hand', registry: useMemo(() => ({ hand }), [hand]) });

  const [running, setRunning] = useState(false);
  const [view, setView] = useState<View>(() => cameraView(game.current.camera, DIMS));

  const frameMs = useRef(0);
  const [stats, setStats] = useState({ frame: 0, nodes: 0, writes: 0 });
  const writes = useRef(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setStats({ frame: frameMs.current, nodes: scene.nodes.size, writes: writes.current }),
      200,
    );
    return () => window.clearInterval(id);
  }, [scene]);

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
      if (g.outcome !== 'playing') g.ended += frame;

      if (running && g.outcome === 'playing') {
        advanceWorld(
          g,
          frame,
          () => ({
            left: input.current.left,
            right: input.current.right,
            jumpHeld: input.current.jumpHeld,
            jumpPressed: consumeJumpPress(input),
          }),
          NO_HOOKS,
        );
      }

      // One batch per frame: one history entry, one notify, one repaint —
      // regardless of how many nodes moved.
      scene.batch('frame', () => syncScene(scene, g));
      writes.current++;

      // The camera is the canvas view, so scene nodes and the parallax bands
      // all project through it. A shake nudges the view rather than the
      // camera, keeping the follow state clean.
      const v = cameraView(g.camera, DIMS);
      const shake = g.shake;
      setView(shake > 0
        ? {
            ...v,
            x: v.x + Math.sin(g.elapsed * 53) * SHAKE_MAGNITUDE * (shake / SHAKE_DURATION),
            y: v.y + Math.cos(g.elapsed * 47) * SHAKE_MAGNITUDE * (shake / SHAKE_DURATION),
          }
        : v);
    });
  }, [animator, running, input, scene]);

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
        const style = { fontFamily: 'sans-serif', fontSize: 14, fill: { fill: 'solid' as const, color: COLORS.hud } };
        return [
          textCommand(12, 22, `♥ ${Math.max(g.lives, 0)}`, style),
          textCommand(72, 22, `◆ ${g.score} / ${g.coins.length}`, style),
          textCommand(190, 22, `${g.elapsed.toFixed(1)}s`, style),
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

    return { far: band('far', 0.2), mid: band('mid', 0.45), near: band('near', 0.7), hud, callouts, ending };
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
    scene.batch('swarm', () => {
      entityNodes([], extra, WORLD.goal)
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
        <button className="ckd-btn" onClick={onRestart}>restart</button>
        <button className="ckd-btn" onClick={swarm}>swarm +40</button>
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
        view={view}
        onViewChange={setView}
        layers={{
          far: { layer: layers.far, before: 'scene' },
          mid: { layer: layers.mid, before: 'scene' },
          near: { layer: layers.near, before: 'scene' },
          hud: { layer: layers.hud, after: 'scene' },
          callouts: { layer: layers.callouts, after: 'hud' },
          ending: { layer: layers.ending, after: 'callouts' },
          selectionOverlay: null,
        }}
      />
      <div className="ckd-toolbar">
        <span className="ckd-readout">frame {stats.frame.toFixed(1)} ms</span>
        <span className="ckd-readout">nodes {stats.nodes}</span>
        <span className="ckd-readout">frames committed {stats.writes}</span>
      </div>
      <div className="ckd-hint">
        The same platformer as the side-scroller load test, built the way the
        engine intends: every tile, coin, enemy and bone is a scene node, and the
        camera is the canvas view rather than a projection each layer applies
        itself. Arrow keys or WASD to move, space to jump.
      </div>
    </div>
  );
}
