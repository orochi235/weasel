import {
  type Scene,
  SceneViewCanvas,
  type SceneViewCanvasProps,
  type SceneViewDrawOne,
  screenToWorld,
  type View,
  viewToTransform,
} from '@weasel-js/core';
import { type LoupePoint, type LoupeSize, loupeExtent, loupeInnerView } from '@weasel-js/loupe';

/** A `@weasel-js/core` scene to magnify, handed to `<SceneLoupe>` through `LoupeOptions.sceneView`. */
export interface SceneViewSource<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  /** The board's own current camera. A thunk is read fresh at every render, as a host's camera moves outside
   *  React — the same contract `CameraHeldViewProps.view` uses elsewhere in core. */
  view: View | (() => View);
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>;
  extraCommands?: SceneViewCanvasProps<TData, TLayer, TPose>['extraCommands'];
  paintBounds?: SceneViewCanvasProps<TData, TLayer, TPose>['paintBounds'];
}

/** Props for `<SceneLoupe>`. */
export interface SceneLoupeProps<TData, TLayer extends string, TPose>
  extends SceneViewSource<TData, TLayer, TPose> {
  aim: LoupePoint;
  factor: number;
  /** One number for a round or square lens, or a width and a height. */
  diameter: LoupeSize;
}

/**
 * Paints a vector lens over a bare `@weasel-js/core` scene — a host with no `<CanvasStack>` of its own. Re-renders
 * the scene's own layers through a second, zoomed `View` centered on `aim`, into its own `<canvas>` DOM element, so
 * it stays sharp at any factor and clips to a true circle for free (unlike a view painted onto the host's main
 * surface, which can only clip to a rect).
 */
export function SceneLoupe<TData, TLayer extends string, TPose>({
  aim,
  factor,
  diameter,
  scene,
  view,
  drawOne,
  extraCommands,
  paintBounds,
}: SceneLoupeProps<TData, TLayer, TPose>) {
  const { width, height } = loupeExtent(diameter);
  const outer = typeof view === 'function' ? view() : view;
  const [wx, wy] = screenToWorld(aim.x, aim.y, viewToTransform(outer));
  const inner = loupeInnerView(
    { x: wx, y: wy },
    outer,
    { x: 0, y: 0, w: width, h: height },
    factor,
  );
  return (
    <SceneViewCanvas
      scene={scene}
      view={inner}
      drawOne={drawOne}
      extraCommands={extraCommands}
      paintBounds={paintBounds}
      width={width}
      height={height}
      className="lk-loupe__canvas"
    />
  );
}
