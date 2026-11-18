import type { LoupeMode } from '@weasel-js/loupe';
import type { RefObject } from 'react';
import type { CameraContextValue } from '../canvas/CameraInput';
import type { CanvasStackContextValue, CanvasStackSurface } from '../canvas/CanvasStackContext';
import { fromCameraView } from '../canvas/cameraView';
import type { ViewportSize } from '../canvas/worldSpec';
import type { ViewTransform2D } from '../instrument/types';
import { CanvasLoupe } from './CanvasLoupe';
import { DomLoupe } from './DomLoupe';
import { SceneLoupe } from './SceneLoupe';
import { SourceLoupe } from './SourceLoupe';
import type { ResolvedLoupe } from './types';

const IDENTITY: ViewTransform2D = { zoom: 1, pan: { x: 0, y: 0 } };

/** Props for {@link LoupePainter}. */
export interface LoupePainterProps<TData, TLayer extends string, TPose> {
  options: ResolvedLoupe<TData, TLayer, TPose>;
  shows: { x: number; y: number };
  shownFactor: number;
  box: { width: number; height: number };
  mode: LoupeMode;
  size: ViewportSize;
  view: ViewTransform2D | undefined;
  stack: CanvasStackContextValue | null;
  camera: CameraContextValue | null;
  host: RefObject<HTMLElement | null>;
  surface: CanvasStackSurface | undefined;
}

/** Picks and renders the one painter a resolved loupe calls for: `sceneView`'s re-rendered `@weasel-js/core`
 *  scene, `render`'s re-drawn DOM, `source`'s captured pixels, or the ambient `<CanvasStack>`'s own layers. A
 *  hollow lens has none: its host draws into the box `onLens` reports. */
export function LoupePainter<TData, TLayer extends string, TPose>({
  options,
  shows,
  shownFactor,
  box,
  mode,
  size,
  view,
  stack,
  camera,
  host,
  surface,
}: LoupePainterProps<TData, TLayer, TPose>) {
  if (options.hollow) return null;
  if (options.sceneView) {
    const { scene, view: sceneViewCamera, drawOne, extraCommands, paintBounds } = options.sceneView;
    return (
      <SceneLoupe
        aim={shows}
        factor={shownFactor}
        diameter={box}
        scene={scene}
        view={sceneViewCamera}
        drawOne={drawOne}
        extraCommands={extraCommands}
        paintBounds={paintBounds}
      />
    );
  }
  if (options.render) {
    return (
      <DomLoupe
        aim={shows}
        factor={shownFactor}
        mode={mode}
        diameter={box}
        size={size}
        view={
          view ??
          stack?.view ??
          (camera ? fromCameraView(camera.view.get(), camera.frame) : IDENTITY)
        }
        frame={stack?.frame ?? camera?.frame}
        render={options.render}
      />
    );
  }
  if (options.source) {
    return (
      <SourceLoupe
        aim={shows}
        factor={shownFactor}
        diameter={box}
        source={options.source}
        hostRef={host}
      />
    );
  }
  if (surface && stack) {
    return (
      <CanvasLoupe
        aim={shows}
        factor={shownFactor}
        mode={mode}
        diameter={box}
        surface={surface}
        view={stack.view}
        frame={stack.frame}
        worldSpec={surface.worldSpec}
      />
    );
  }
  return null;
}
