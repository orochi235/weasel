/**
 * `renderSceneToCanvas` — substrate for detached, read-only scene views
 * (`<SceneViewCanvas>` / `<MinimapCanvas>`). Given a `<canvas>`, a `Scene`,
 * a `View`, and a per-node `drawOne`, render one frame.
 */

import type { WeaselRenderer } from '@weasel-js/renderer';
import { cachedCanvasRenderer, paintCanvas } from './canvasRenderer';
import { viewToMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from '../core/viewport/view';
import type { Node, NodeId, Scene } from '../core/scene/types';
import { wrapNodeOutput } from './wrapNodeOutput';
import { buildSceneTree, type HierarchicalAdapter } from './buildSceneTree';
import { sceneToAdapter } from './sceneAdapter';
import { withInheritedPaints } from './inheritedPaints';
import { withDerivedPaths, sceneDerivedPathOf } from './derivedPath';
import { withColorOverrides } from './colorOverrides';
import type { ColorOverrideRegistry } from '@weasel-js/animator';
import type { SceneViewDrawOne } from './NodeShape';
import { paintedSceneLayers } from './sceneLayerPaint';
import { cullDrawCommands } from '@weasel-js/renderer';
import { paintMissesView, type PaintBoundsFn } from './paintCull';
import { paintBoundsFor } from './defaultDrawOne';

export type { SceneViewDrawOne } from './NodeShape';

/**
 * Which scene layers a detached view paints, on top of each layer's own
 * `visible` flag. Keyed the way `<SceneCanvas>` keys its scene layers —
 * `scene:<layerId>` — so the map a main canvas takes serves its minimap too.
 */
export interface SceneViewLayers {
  /** `false` hides that layer in this view. It cannot show one the scene hides. */
  layerVisibility?: Record<string, boolean>;
  /** Paint order, bottom first. A listed order is the whole list: a scene
   *  layer left out of it is not painted. */
  layerOrder?: readonly string[];
}

/** The view size `buildSceneViewCommands` culls to, and how it bounds a
 *  node's paint before painting it. */
export interface SceneViewCull<TData, TLayer extends string, TPose> {
  width: number;
  height: number;
  paintBounds?: PaintBoundsFn<Node<TData, TLayer, TPose>, TPose>;
}

/** What to draw into an existing canvas: the scene, the view, and the same
 *  painting hooks `<SceneCanvas>` takes. */
export interface RenderSceneToCanvasArgs<TData, TLayer extends string, TPose> {
  /** The DOM canvas to paint into. The first call on a given canvas creates
   *  its renderer and later calls reuse it;
   *  `releaseCanvasRenderer(canvas)` frees it. */
  canvas: HTMLCanvasElement;
  scene: Scene<TData, TLayer, TPose>;
  /** Camera view applied to scene and `extraCommands` alike. */
  view: View;
  /** CSS-pixel size. The drawing buffer is set to `width × dpr` and
   *  `height × dpr`; the element's CSS size is the caller's to set. */
  width: number;
  height: number;
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Commands appended after the scene-node output, wrapped in the same view
   *  transform as scene commands. */
  extraCommands?: DrawCommand[];
  /** Per-id alpha multiplier, mirroring `<SceneCanvas>`'s scene-slot
   *  `alphaFor`. Defaults to `() => 1`. */
  alphaFor?: (id: string) => number;
  /** Per-view layer visibility. See {@link SceneViewLayers}. */
  layerVisibility?: SceneViewLayers['layerVisibility'];
  /** Per-view layer order. See {@link SceneViewLayers}. */
  layerOrder?: SceneViewLayers['layerOrder'];
  /** Animated vertex colors to paint, typically an animator's
   *  `colorOverrides` — see `NodePaintCtx.vertexColors`. */
  colorOverrides?: ColorOverrideRegistry;
  /** Skip what cannot reach the `width × height` view: nodes `paintBounds`
   *  places outside it are not painted, and scene commands that cannot reach
   *  it are dropped before the renderer — the scene slot's `cull`. Off by
   *  default. `extraCommands` are never culled. */
  cull?: boolean;
  /** Where `drawOne`'s output for a node can reach, as on the scene slot.
   *  Defaults to `defaultPaintBounds` when `drawOne` is `defaultDrawOne`. */
  paintBounds?: PaintBoundsFn<Node<TData, TLayer, TPose>, TPose>;
  /** Device-pixel ratio. Defaults to `window.devicePixelRatio || 1` when
   *  available, otherwise 1. */
  dpr?: number;
}

/** Test seam: the renderer `renderSceneToCanvas` created for a canvas. Not
 *  re-exported from the barrel. */
export function __getCachedRendererForTest(
  canvas: HTMLCanvasElement,
): WeaselRenderer | undefined {
  return cachedCanvasRenderer(canvas);
}

/**
 * Present a `Scene` as the reading surface `buildSceneTree` walks: the scene
 * adapter's own reads, under this view's layer list.
 */
function sceneAsHierarchy<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  layers: SceneViewLayers = {},
): HierarchicalAdapter<Node<TData, TLayer, TPose>, TPose> {
  const { getNode, getChildren, getPose, composePose } = sceneToAdapter(scene);
  return {
    getLayers: () =>
      paintedSceneLayers(scene.layers, layers)
        .map((l) => ({ id: l.id, visible: l.visible, parallax: l.parallax })),
    getNode,
    getChildren,
    getPose,
    ...(composePose ? { composePose } : {}),
  };
}

/**
 * Build the DrawCommand list that `renderSceneToCanvas` would dispatch, in
 * screen space. Pure — no GL, no DOM. Walks the scene through `buildSceneTree`,
 * the same walk `<SceneCanvas>` uses, which is what keeps hidden layers
 * unpainted and container clips applied here.
 *
 * Each node's commands go through `wrapNodeOutput` — pose rotation, then the
 * `alphaFor` multiplier — so a `drawOne` that rotates its own output rotates
 * twice; emit unrotated geometry and let the pose drive it.
 *
 * Output is one group per **visible** layer, in scene-layer order (or
 * `layers.layerOrder`), each holding one group per node on that layer.
 */
export function buildSceneViewCommands<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  view: View,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
  extraCommands?: ReadonlyArray<DrawCommand>,
  alphaFor?: (id: string) => number,
  /** This view's own layer visibility and order. */
  layers?: SceneViewLayers,
  /** Animated vertex colors to paint, typically an animator's `colorOverrides`. */
  colorOverrides?: ColorOverrideRegistry,
  /** Cull the scene to this CSS-pixel view size — see
   *  `RenderSceneToCanvasArgs.cull`. Omit to paint every node. */
  cull?: SceneViewCull<TData, TLayer, TPose>,
): DrawCommand[] {
  const derivedOnly = withDerivedPaths(scene, withInheritedPaints(scene, drawOne));
  const derived = colorOverrides ? withColorOverrides(colorOverrides, derivedOnly) : derivedOnly;
  const derivedPathOf = sceneDerivedPathOf(scene);
  const wrappedDrawOne = (
    node: Node<TData, TLayer, TPose>,
    pose: TPose,
    v: View,
  ): DrawCommand[] => {
    const overrideAlpha = scene.overrides.read(node.id as NodeId)?.alpha ?? 1;
    return wrapNodeOutput(
      derived(node, pose, v),
      pose,
      (alphaFor ? alphaFor(node.id) : 1) * overrideAlpha,
    );
  };

  const hierarchy = sceneAsHierarchy(scene, layers);

  const cullRect = cull ? { x: 0, y: 0, width: cull.width, height: cull.height } : undefined;
  const culled = cullRect && cull?.paintBounds ? paintMissesView(cull.paintBounds, view, cullRect) : undefined;
  const tree: DrawCommand[] = buildSceneTree(
    hierarchy as Parameters<typeof buildSceneTree>[0],
    wrappedDrawOne as unknown as Parameters<typeof buildSceneTree>[1],
    view,
    undefined,
    derivedPathOf as unknown as Parameters<typeof buildSceneTree>[4],
    culled as Parameters<typeof buildSceneTree>[5],
  );
  const children = cullRect ? cullDrawCommands(tree, viewToMat3(view), cullRect) : tree;
  if (extraCommands && extraCommands.length > 0) {
    for (const cmd of extraCommands) children.push(cmd);
  }
  return [{
    kind: 'group',
    transform: viewToMat3(view),
    children,
  }];
}

/**
 * The commands `renderSceneToCanvas` paints for one frame — everything in
 * `args` but the canvas. `<SceneViewCanvas>` paints these through its own
 * renderer lease.
 */
export function sceneViewFrame<TData, TLayer extends string, TPose>(
  args: Omit<RenderSceneToCanvasArgs<TData, TLayer, TPose>, 'canvas'>,
): DrawCommand[] {
  const {
    scene, view, width, height, drawOne, extraCommands, alphaFor, layerVisibility, layerOrder,
    colorOverrides, cull,
  } = args;
  return buildSceneViewCommands(
    scene, view, drawOne, extraCommands, alphaFor, { layerVisibility, layerOrder }, colorOverrides,
    cull ? { width, height, paintBounds: args.paintBounds ?? paintBoundsFor(drawOne) } : undefined,
  );
}

/**
 * Render one frame of `scene` at `view` into `canvas`. Where no WebGL2
 * context is available (jsdom) the call paints nothing. The canvas's renderer
 * lives until `releaseCanvasRenderer(canvas)`.
 */
export function renderSceneToCanvas<TData, TLayer extends string, TPose>(
  args: RenderSceneToCanvasArgs<TData, TLayer, TPose>,
): void {
  const { canvas, view, width, height, dpr } = args;
  paintCanvas(canvas, sceneViewFrame(args), view, { width, height, dpr });
}
