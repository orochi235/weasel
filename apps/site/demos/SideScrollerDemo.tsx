import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, WeaselProvider, deriveParallaxView, useAnimator, useScene } from '@weasel-js/core';
import type { Dims, DrawCommand, RenderLayer, View } from '@weasel-js/core';
import { CAM_SCALE, cameraView, createCamera, followCamera, type Camera } from './platformer/camera';
import { WORLD } from './platformer/worldLevel';
import { drawBackdrop, drawTiles } from './platformer/skin';

const W = 720;
const H = 405;
const DIMS: Dims = { width: W, height: H };
/** The canvas view never moves — every layer projects through the camera ref
 *  itself, which keeps the whole game loop out of React state. */
const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

interface GameRefs {
  camera: Camera;
}

export function SideScrollerDemo() {
  const animator = useAnimator();
  const scene = useScene({ items: [] });
  const game = useRef<GameRefs>({ camera: createCamera(WORLD.spawn) });
  const [running, setRunning] = useState(false);

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

    return { bands, tiles };
  }, []);

  // A camera with nothing to follow still has to run, or the first frame after
  // the player lands snaps instead of easing.
  useEffect(() => animator.keepAlive(), [animator]);

  useEffect(() => {
    let last = performance.now();
    return animator.onTick(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!running) return;
      game.current.camera = followCamera(game.current.camera, WORLD.spawn, DIMS, WORLD, dt);
    });
  }, [animator, running]);

  return (
    <WeaselProvider>
      <div className="ckd-demo">
        <div className="ckd-toolbar">
          <button className="ckd-btn" onClick={() => setRunning((r) => !r)}>
            {running ? 'pause' : 'restart'}
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
