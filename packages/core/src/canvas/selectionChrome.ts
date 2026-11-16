/**
 * The selection chrome a canvas draws and lets a press grab: the options the `selectionOverlay` slot takes, and
 * the {@link SelectionChrome} an editing preset supplies to draw and hit-test it. With none, the slot paints
 * nothing and a press grabs no handle.
 */
import type { CommandFill, CommandStroke } from '@weasel-js/paint';
import type { NodeId } from 'core/scene/types';
import type { RenderLayer } from 'core/layers/render';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { Affordance } from 'affordances/types';
import type { ResizeHandleLayout } from 'interactions/gestures/resizeHandles';
import type { DrawnBoundsScene } from './drawnBounds';

/** Handle visuals, as a consumer supplies them. */
export interface SelectionHandleStyle {
  size?: number;
  fill?: CommandFill;
  outline?: CommandStroke;
}

/** Options every selection layer shares. `getSelection` and `getPose` are
 *  declared on {@link SelectionOverlayLayerOptions}, which makes both optional —
 *  omitted, they come off the draw envelope. */
export interface SelectionLayerCommon<TPose> {
  /** How to read poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  /** Walk a container's direct children (e.g. `scene.childrenOf`). When
   *  supplied with `isContainer`, any id that resolves to a container is
   *  rendered using the union bounds of all its transitive leaves. */
  getChildren?: (id: string) => readonly string[];
  /** True when `id` is a structural container. */
  isContainer?: (id: string) => boolean;
  /** The nodes behind the ids `getPose` answers for. With it, a stroked
   *  node's chrome sits on its stroke (`drawnBoundsOf`); without, on its
   *  pose box. Ignored when bounds come off the draw envelope. */
  scene?: DrawnBoundsScene;
}

/** Options for `createSelectionOutlineLayer`. The overlay layer's options
 *  minus the handle visuals — the two run the same body. */
export type SelectionOutlineLayerOptions<TPose> =
  Omit<SelectionOverlayLayerOptions<TPose>, 'handles' | 'handlesOf' | 'resizeHandles' | 'rotationHandle'>;

/** Options for `createSelectionHandlesLayer`. The overlay layer's options
 *  minus the outline stroke — the two run the same body. */
export type SelectionHandlesLayerOptions<TPose> =
  Omit<SelectionOverlayLayerOptions<TPose>, 'outline'>;

/** Options for `createSelectionOverlayLayer`. */
export interface SelectionOverlayLayerOptions<TPose>
  extends SelectionLayerCommon<TPose> {
  /**
   * Which ids to draw chrome for. Omit to take them from the `ChromeState` on
   * the draw envelope: the selection of the canvas drawing it, whose views
   * all act on that one selection.
   */
  getSelection?: () => readonly NodeId[];
  /**
   * Resolve an id to the pose to draw chrome around. Return null to skip an
   * id. Omit to take bounds from the same envelope `getSelection` omitted
   * takes ids from.
   *
   * Takes `string` rather than `NodeId` because the container-aware resolver
   * walks expanded leaf ids via `getChildren`, which is generic over strings.
   */
  getPose?: (id: string) => TPose | null;
  /** The outline's stroke, its width in screen pixels. `follow: 'shape'`
   *  traces each node's silhouette from its drawn edge outward, where `pad`
   *  does not apply; a group, or a node with no silhouette, keeps its box.
   *  Needs `scene`. Default `'box'`. */
  outline?: CommandStroke & { pad?: number; follow?: 'box' | 'shape' };
  /** Pass `false` to render outlines only. */
  handles?: SelectionHandleStyle | false;
  /** Where to paint handles, in the bounds' own frame. Replaces the kit's
   *  layout, `resizeHandles` included. */
  handlesOf?: (bounds: Bounds) => { x: number; y: number }[];
  /** The layout the resize affordance hits by: its `hitRadiusPx`, never
   *  `handles.size`, decides which edge handles are painted. Default: edges on,
   *  at the kit's default hit radius. */
  resizeHandles?: Partial<ResizeHandleLayout>;
  /** Draw a rotate badge above the selection's top edge. `true` places it at
   *  the default offset; `distance` sets the offset in screen pixels. Off by
   *  default. */
  rotationHandle?:
    | boolean
    | {
        distance?: number;
      };
  /** Optional separate id list for the per-item outline pass, for a
   *  multi-selection whose handle pass works against a synthetic union id
   *  (e.g. `MULTI_RESIZE_TARGET_ID`) while each real member is outlined.
   *  When omitted, the outline pass uses the handle pass's ids. */
  getOutlineIds?: () => readonly NodeId[];
  /** Optional set of ids to suppress entirely — both outline and handles
   *  are skipped. */
  getSuppressedIds?: () => ReadonlySet<string>;
}


/** The grab sizes a canvas resolves for its chrome, in screen pixels. */
export interface SelectionChromeSizes {
  /** A resize handle's hit radius. */
  handleHitRadius: number;
  /** The rotate band's minimum thickness outside the selection box. */
  rotateBandPx: number;
  /** The rotate badge the overlay paints, so it is grabbed where it is drawn; null when it paints none. */
  rotationBadge: { distancePx: number; sizePx: number } | null;
  /** Resize handles at the edge midpoints as well as the corners. */
  edgeHandles: boolean;
}

/**
 * What draws a canvas's selection chrome and says where a press grabs it: `FeaturePreset.selectionChrome`. One
 * per canvas.
 */
export interface SelectionChrome {
  /** The layer the `selectionOverlay` slot paints, from its resolved options. */
  overlay<TPose>(options: SelectionOverlayLayerOptions<TPose>): RenderLayer<unknown>;
  /** Where that layer paints its rotate badge, in screen pixels, or null when it paints none. */
  rotationBadgeOf(options: Pick<SelectionOverlayLayerOptions<unknown>, 'handles' | 'rotationHandle'>):
    { distancePx: number; sizePx: number } | null;
  /** The chrome a press grabs, bottom to top. The canvas hit-tests its own path anchors over them. */
  affordances(sizes: SelectionChromeSizes): Affordance[];
}
