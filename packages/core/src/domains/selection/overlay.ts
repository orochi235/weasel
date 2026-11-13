/**
 * Selection overlay primitives — render layers for drawing selection
 * outlines and resize handles.
 *
 * **Pose shape:** TPose is generic; callers pass `poseDescriptor` for poses
 * `AUTO_POSE_DESCRIPTOR` can't read. Container ids reduce via `unionAABB`
 * over the projected AABBs.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import type { NodeId } from 'core/scene/types';
import type { RenderLayer } from 'core/layers/render';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { DrawnBoundsScene } from 'canvas/drawnBounds';
import { containerAwareBoundsResolver } from './selectionPose';
import { targetCorners, targetTransformOf, type TargetTransform } from 'core/geometry/targetFrame';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { CommandStroke } from '@weasel-js/paint';
import { resolveStrokeWidth } from '@weasel-js/stroke';
import { DEFAULT_ROTATION_HANDLE_DISTANCE } from 'interactions/actions/rotate/handle';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { ChromeState } from 'core/selection/chromeState';
import { MULTI_RESIZE_TARGET_ID } from 'core/selection/selectionTarget';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { PATH_L, PATH_M, PATH_Z } from '@weasel-js/geom';
import { effectivePoseFrom, previewPoseIn, previewSourcesFrom } from 'canvas/drawEnvelope';
import { rotationHandleCommands } from './rotationBadge';
import { createShapeOutliner, shapeOutlineCommands, viewScaleOf } from './shapeOutline';
import {
  handleCommandsFor, rectPathFor, resolveHandles, type ResizeHandleLayout, type SelectionHandleStyle,
} from './handleCommands';

export type { SelectionHandleStyle };

export { composeSelectionPose, type ComposeSelectionPoseOptions } from './selectionPose';

/** Project world AABB into screen-space AABB using the active view. */
function projectBounds<B extends Bounds>(b: B, view: View): B {
  const t = viewToTransform(view);
  const [sx, sy] = worldToScreen(b.x, b.y, t);
  const [w, h] = [b.width * view.scale.x, b.height * view.scale.y];
  return { ...b, x: Math.min(sx, sx + w), y: Math.min(sy, sy + h), width: Math.abs(w), height: Math.abs(h) };
}

/** Options every selection layer shares. `getSelection` and `getPose` are
 *  declared on {@link SelectionOverlayLayerOptions}, which makes both optional —
 *  omitted, they come off the draw envelope. */
interface SelectionLayerCommon<TPose> {
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
   * the draw envelope, which is what makes one canvas's several views each
   * outline their own selection — the layer is shared, the envelope is not.
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

const DEFAULT_OUTLINE: Required<Pick<CommandStroke, 'paint' | 'width'>> & { pad: number } = {
  paint: { kind: 'solid', color: '#f0e0a8' },
  width: 2,
  pad: 1,
};
function resolveOutlineStroke(opts?: CommandStroke & { pad?: number }): {
  stroke: CommandStroke;
  pad: number;
} {
  if (!opts) {
    return {
      stroke: { paint: DEFAULT_OUTLINE.paint, width: DEFAULT_OUTLINE.width },
      pad: DEFAULT_OUTLINE.pad,
    };
  }
  return {
    stroke: {
      paint: opts.paint ?? DEFAULT_OUTLINE.paint,
      width: opts.width ?? DEFAULT_OUTLINE.width,
      dash: opts.dash,
      cap: opts.cap,
      join: opts.join,
      align: opts.align,
    },
    pad: opts.pad ?? DEFAULT_OUTLINE.pad,
  };
}

/** GL helper: emit an outline command for one bounds entry. */
function outlineCommandsFor(
  ids: readonly string[],
  resolveBounds: (id: string) => Bounds | null,
  stroke: CommandStroke,
  pad: number,
  view: View,
): DrawCommand[] {
  const out: DrawCommand[] = [];
  const align = stroke.align ?? 'center';
  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  for (const id of ids) {
    const worldB = resolveBounds(id);
    if (!worldB) continue;
    const b = projectBounds(worldB, view);
    const padded = {
      x: b.x - pad,
      y: b.y - pad,
      width: b.width + pad * 2,
      height: b.height + pad * 2,
    };
    const xf = targetTransformOf(worldB);
    if (xf.identity) {
      // Upright, the renderer aligns the stroke on the rect itself.
      out.push({ kind: 'path', path: rectPathFor(padded.x, padded.y, padded.width, padded.height), stroke });
      continue;
    }
    // Turned or skewed, the target lands on screen as a parallelogram, so the
    // outline is traced through its projected corners, with the alignment's
    // half-width shift folded into the offset.
    const shift = align === 'outer' ? width / 2 : align === 'inner' ? -width / 2 : 0;
    const q = screenCorners(worldB, xf, view, pad + shift);
    out.push({
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
        coords: new Float32Array([q[0].x, q[0].y, q[1].x, q[1].y, q[2].x, q[2].y, q[3].x, q[3].y]),
        fillRule: 'nonzero',
      },
      stroke: { ...stroke, align: 'center' },
    });
  }
  return out;
}

/**
 * A framed target's corners on screen, TL/TR/BR/BL, each pushed `pad` screen
 * pixels out from both edges that meet there.
 */
function screenCorners(
  worldB: Bounds,
  xf: TargetTransform,
  view: View,
  pad: number,
): { x: number; y: number }[] {
  const t = viewToTransform(view);
  const q = targetCorners(worldB, xf).map((w) => {
    const [x, y] = worldToScreen(w.x, w.y, t);
    return { x, y };
  });
  if (pad === 0) return q;
  const [ccx, ccy] = worldToScreen(worldB.x + worldB.width / 2, worldB.y + worldB.height / 2, t);
  const normal = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const mx = (a.x + b.x) / 2 - ccx, my = (a.y + b.y) / 2 - ccy;
    return nx * mx + ny * my < 0 ? { x: -nx, y: -ny } : { x: nx, y: ny };
  };
  return q.map((c, i) => {
    const n1 = normal(q[(i + 3) % 4], c);
    const n2 = normal(c, q[(i + 1) % 4]);
    // The point `pad` off both edge lines.
    const k = pad / (1 + n1.x * n2.x + n1.y * n2.y);
    return { x: c.x + (n1.x + n2.x) * k, y: c.y + (n1.y + n2.y) * k };
  });
}

/** Which passes a selection layer runs. The three exported factories differ
 *  only in this — everything else they do is shared, so a fix to one is a fix
 *  to all three. */
interface SelectionPasses {
  readonly id: string;
  readonly label: string;
  readonly outline: boolean;
  readonly handles: boolean;
}

function buildSelectionLayer<TPose>(
  opts: SelectionOverlayLayerOptions<TPose>,
  passes: SelectionPasses,
): RenderLayer<unknown> {
  const { stroke, pad } = resolveOutlineStroke(opts.outline);
  const handlesEnabled = passes.handles && opts.handles !== false;
  const handles = handlesEnabled ? resolveHandles(opts.handles || undefined) : null;
  const { handlesOf, resizeHandles } = opts;
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const getPose = opts.getPose;
  const poseBounds = getPose
    ? containerAwareBoundsResolver(getPose, d, opts.getChildren, opts.isContainer, opts.scene)
    : null;
  const shapeOutliner = opts.outline?.follow === 'shape' && opts.scene ? createShapeOutliner() : null;
  const rotationHandleDistance = passes.handles
    ? rotationBadgeOf(opts)?.distancePx ?? null
    : null;

  return {
    id: passes.id,
    label: passes.label,
    space: 'screen',
    draw: (data, view) => {
      // The synthetic multi-resize id resolves to `ChromeState.unionBounds`,
      // the same value the affordance hit-tester reads, so painted chrome
      // and its hit region stay in agreement. With no chromeState on the
      // draw envelope, fall through to the supplied resolver.
      const chromeState = asChromeState(data);
      const allIds = opts.getSelection
        ? opts.getSelection()
        : chromeSelectionIds(chromeState);
      if (allIds.length === 0) return [];
      const suppressed = opts.getSuppressedIds?.();
      const ids = suppressed && suppressed.size > 0
        ? allIds.filter((id) => !suppressed.has(id as unknown as string))
        : allIds;
      if (ids.length === 0) return [];
      // Chrome-caps: gate each pass on its canonical id. When no
      // `getIsVisible` is wired, every pass runs.
      const isVisible = asIsVisible(data);
      const showOutline = passes.outline && (isVisible ? isVisible('selection.outline') : true);
      const showHandles = isVisible ? isVisible('selection.resize-handles') : true;
      const showRotation = isVisible ? isVisible('selection.rotation-handle') : true;

      const resolveBounds = poseBounds
        ? (id: string) => poseBounds(id, view.scale)
        : (id: string) => chromeState?.boundsOf(id) ?? null;
      const resolveTargetBounds = (id: string): Bounds | null => {
        if (id === MULTI_RESIZE_TARGET_ID && chromeState?.unionBounds != null) {
          return chromeState.unionBounds;
        }
        return resolveBounds(id);
      };

      const out: DrawCommand[] = [];
      if (showOutline) {
        const outlineIdsRaw = opts.getOutlineIds
          ? opts.getOutlineIds()
          : (opts.getSelection ? ids : (chromeState?.selection ?? ids));
        const outlineIds = suppressed && suppressed.size > 0
          ? outlineIdsRaw.filter((id) => !suppressed.has(id as unknown as string))
          : outlineIdsRaw;
        let boxed = outlineIds as readonly string[];
        if (shapeOutliner && opts.scene) {
          const previews = previewSourcesFrom(data);
          const traced = shapeOutliner.outline(boxed, {
            scene: opts.scene,
            poseOf: (id) => effectivePoseFrom(data, id) ?? getPose?.(id as never) ?? opts.scene!.get(id as NodeId)?.pose,
            inFlight: (id) => previewPoseIn(previews, id) != null,
          }, viewScaleOf(view));
          for (const cmd of shapeOutlineCommands(traced.paths, stroke, view)) out.push(cmd);
          boxed = traced.boxed;
        }
        for (const cmd of outlineCommandsFor(boxed, resolveTargetBounds, stroke, pad, view)) out.push(cmd);
      }
      if (!handles) return out;
      if (showHandles) {
        for (const cmd of handleCommandsFor(ids, resolveTargetBounds, handles, handlesOf, resizeHandles, view)) out.push(cmd);
      }
      if (showRotation && rotationHandleDistance !== null) {
        for (const id of ids) {
          const b = resolveTargetBounds(id);
          if (!b) continue;
          for (const cmd of rotationHandleCommands(b, handles, rotationHandleDistance, view)) {
            out.push(cmd);
          }
        }
      }
      return out;
    },
  };
}

/** Where the overlay paints its rotate badge and how big it is, in screen
 *  pixels, or `null` when it paints none. The badge's grab region and its
 *  slops halo read this too, so all three agree on it. */
export function rotationBadgeOf(
  opts: Pick<SelectionOverlayLayerOptions<unknown>, 'handles' | 'rotationHandle'>,
): { distancePx: number; sizePx: number } | null {
  const r = opts.rotationHandle;
  if (!r || opts.handles === false) return null;
  return {
    distancePx: r === true ? DEFAULT_ROTATION_HANDLE_DISTANCE : r.distance ?? DEFAULT_ROTATION_HANDLE_DISTANCE,
    sizePx: resolveHandles(opts.handles || undefined).size,
  };
}
/**
 * `RenderLayer` that draws selection outlines only. Stack alongside
 * `createSelectionHandlesLayer` (or use `createSelectionOverlayLayer`, which
 * runs both passes in one layer) when both are wanted.
 */
export function createSelectionOutlineLayer<TPose>(
  opts: SelectionOutlineLayerOptions<TPose>,
): RenderLayer<unknown> {
  return buildSelectionLayer(opts, {
    id: 'selection-outline',
    label: 'Selection outline',
    outline: true,
    handles: false,
  });
}

/**
 * `RenderLayer` that draws selection handles only. Stack on top of
 * `createSelectionOutlineLayer` (handles render on top of the outline).
 */
export function createSelectionHandlesLayer<TPose>(
  opts: SelectionHandlesLayerOptions<TPose>,
): RenderLayer<unknown> {
  return buildSelectionLayer(opts, {
    id: 'selection-handles',
    label: 'Selection handles',
    outline: false,
    handles: true,
  });
}

/**
 * Draws outlines then handles in a single layer. Exactly equivalent to
 * stacking `createSelectionOutlineLayer` and `createSelectionHandlesLayer` —
 * all three run the same body. Pass `handles: false` to render outlines only.
 */
export function createSelectionOverlayLayer<TPose>(
  opts: SelectionOverlayLayerOptions<TPose>,
): RenderLayer<unknown> {
  return buildSelectionLayer(opts, {
    id: 'selection-overlay',
    label: 'Selection',
    outline: true,
    handles: true,
  });
}

/** Pull a chrome-caps visibility predicate off the draw `data` envelope.
 *  Returns `null` when the caller passed bare data (no `getIsVisible`
 *  thunk) — the layer then renders unconditionally. */
function asIsVisible(data: unknown): ((id: string) => boolean) | null {
  const maybe = data as { getIsVisible?: () => (id: string) => boolean };
  if (typeof maybe?.getIsVisible === 'function') return maybe.getIsVisible();
  return null;
}

/** The ids the handle pass works against when the layer takes its selection
 *  from the envelope: the synthetic union id for a multi-selection, the
 *  selection itself otherwise. */
function chromeSelectionIds(state: ChromeState | null): readonly NodeId[] {
  if (!state) return [];
  if (state.multiActive) return [MULTI_RESIZE_TARGET_ID as NodeId];
  return state.selection;
}

/** Pull live `ChromeState` off the draw `data` envelope. Returns `null` for
 *  callers that pass plain data with no `getChromeState` thunk — the layer
 *  then resolves the multi-union via the supplied `getPose` resolver. */
function asChromeState(data: unknown): ChromeState | null {
  const maybe = data as { getChromeState?: () => ChromeState };
  if (typeof maybe?.getChromeState === 'function') return maybe.getChromeState();
  return null;
}
