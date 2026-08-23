import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, WeaselProvider, deriveParallaxView, resolveSkeleton, useAnimator, useScene } from '@weasel-js/core';
import type { Dims, DrawCommand, RenderLayer, View } from '@weasel-js/core';
import { createAudioEngine } from '@weasel-js/audio';
import type { AudioEngine, SoundHandle, VoiceHandle } from '@weasel-js/audio';
import { CAM_SCALE, cameraView, createCamera, followCamera, type Camera } from './platformer/camera';
import { WORLD } from './platformer/worldLevel';
import { drawBackdrop, drawPlayer, drawTiles } from './platformer/skin';
import { createBodyState, spikeOverlap, stepBody, STEP, type BodyState, type Input } from './platformer/physics';
import { createAnimState, nextAnimState, resolvePose, type AnimState } from './platformer/animState';
import { INVULN } from './platformer/entities';
import { PLAYER_SKELETON } from './platformer/skeleton';
import { consumeJumpPress, usePlatformerInput } from './platformer/useInput';
import { registerSounds, type SoundName } from './platformer/sfx';

const W = 720;
const H = 405;
const DIMS: Dims = { width: W, height: H };
/** The canvas view never moves — every layer projects through the camera ref
 *  itself, which keeps the whole game loop out of React state. */
const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

interface GameRefs {
  camera: Camera;
  player: BodyState;
  anim: AnimState;
  /** Seconds of remaining invulnerability. */
  invuln: number;
  /** Accumulated real time not yet consumed by a fixed step. */
  accumulator: number;
}

const freshGame = (): GameRefs => ({
  camera: createCamera(WORLD.spawn),
  player: createBodyState(WORLD.spawn),
  anim: createAnimState(),
  invuln: 0,
  accumulator: 0,
});

export function SideScrollerDemo() {
  const animator = useAnimator();
  const scene = useScene({ items: [] });
  const input = usePlatformerInput();
  const game = useRef<GameRefs>(freshGame());
  const [running, setRunning] = useState(false);

  const audio = useRef<{ engine: AudioEngine; sounds: Record<SoundName, SoundHandle>; bed: VoiceHandle | null } | null>(null);
  const [audioState, setAudioState] = useState<'off' | 'suspended' | 'running'>('off');

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

  const fire = (name: SoundName, gain = 0.8) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    a.engine.play(a.sounds[name], { bus: 'sfx', gain });
  };

  /** A hit drops the music under the hurt sound and brings it back. */
  const duckMusic = () => {
    const a = audio.current;
    if (!a) return;
    a.engine.bus('music').setGain(0.15, 60);
    window.setTimeout(() => a.engine.bus('music').setGain(0.5, 400), 260);
  };

  const layers = useMemo(() => {
    const view = () => cameraView(game.current.camera, DIMS);

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

    return { bands, tiles, player };
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
      if (!running) return;

      const g = game.current;
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
      g.camera = followCamera(g.camera, g.player.body, DIMS, WORLD, frame);
      audio.current?.engine.setListener({ x: g.player.body.x, y: g.player.body.y });
    });
  }, [animator, running, input]);

  return (
    <WeaselProvider>
      <div className="ckd-demo">
        <div className="ckd-toolbar">
          <button className="ckd-btn" onClick={() => setRunning((r) => !r)}>
            {running ? 'pause' : 'restart'}
          </button>
          <button className="ckd-btn" onClick={enableAudio} disabled={audioState === 'running'}>
            {audioState === 'running' ? 'audio on' : 'enable audio'}
          </button>
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
          layers={{
            backdropFar: { layer: layers.bands[0], before: 'scene' },
            backdropMid: { layer: layers.bands[1], after: 'backdropFar' },
            backdropNear: { layer: layers.bands[2], after: 'backdropMid' },
            tiles: { layer: layers.tiles, after: 'backdropNear' },
            player: { layer: layers.player, after: 'tiles' },
            scene: { drawOne: () => [] },
            selectionOverlay: null,
          }}
        />
        <div className="ckd-hint">
          A platformer built as a load test for the animation timeline and the audio
          engine. Everything is drawn by custom render layers; the scene graph is off.
        </div>
      </div>
    </WeaselProvider>
  );
}
