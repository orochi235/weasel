/**
 * The dispatcher-side affordance classifier: answers "what piece of selection
 * chrome is under this world point?" by assembling the kit's affordances and
 * running the one shared walk (`hitAffordanceRegions`).
 */

import type { BodyClassification } from '@weasel-js/gestures';
import type { ChromeState } from 'core/selection/chromeState';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import type { View } from 'core/viewport/view';
import type { AffordanceHit, WorldPoint } from '@weasel-js/routing';
import type { Affordance, CommonAffordanceScratch, LayerHit } from 'affordances/types';
import { hitAffordanceRegions, type AffordanceRegionHit } from 'affordances/hitAffordanceRegions';
import { createCornerResizeAffordance } from 'affordances/cornerResize';
import { createRotationAffordance } from 'affordances/rotationHandle';
import { createPathAnchorAffordances, type AnchorState } from 'affordances/pathAnchors';
import { targetSizesPx } from 'core/device/targets';

export type { AnchorState };

/** What decides the kit's chrome affordances — their sizes and which ones
 *  exist. Shared by the hit-test and the slops overlay, which draws them. */
export interface ChromeAffordanceOptions {
  /** Pointer-size multiplier from the live `DeviceProfile`. Every default
   *  below is resolved through {@link targetSizesPx} at this scale, so the
   *  grab zone tracks the painted chrome on a coarse pointer. Default 1. */
  targetScale?: number;
  /** Corner-handle hit radius in screen px. Overrides the device-scaled default. */
  handleHitRadius?: number;
  /** Anchor / control hit radius in screen px. Overrides the device-scaled default. */
  anchorHitRadius?: number;
  /** Minimum rotate-band thickness outside the selection AABB, in screen px.
   *  Overrides the device-scaled default. */
  rotateBandPx?: number;
  /** The rotate badge the selection overlay paints (`rotationBadgeOf`), so
   *  it can be grabbed where it is drawn. Omitted or null, only the rotate
   *  ring is hit-tested. */
  rotationBadge?: { distancePx: number; sizePx: number } | null;
  /** Resize handles at the edge midpoints as well as the corners. Default true. */
  edgeHandles?: boolean;
  /** Anchor-editing state. When omitted, anchors aren't hit-tested. */
  getAnchorState?: () => AnchorState | null;
}

export interface BuildAffordanceAtOptions extends ChromeAffordanceOptions {
  /** Live ChromeState at call time — current selection plus effective bounds,
   *  including in-flight move/resize ghost poses. */
  getChromeState: () => ChromeState;
  /** Live view. Needed because region hit radii and the rotate band are
   *  declared in screen pixels and resolved against the current scale. */
  getView: () => View;
  /** The affordances to walk, when the caller built them itself to share
   *  them (`chromeAffordances`). Otherwise built from these options. */
  affordances?: readonly Affordance[];
  /** Chrome-caps resolver. Keeps the hit-test and the renderer agreeing on
   *  which chrome is live (resize handles gated by
   *  `'selection.resize-handles'`, rotation by `'selection.rotation-handle'`,
   *  anchors by `'path-edit.anchors'`). Omitting defaults to always-visible. */
  getIsVisible?: () => (id: string) => boolean;
}

/**
 * The kit's selection chrome as affordances, bottom → top: rotate ring (and
 * badge), resize handles, then anchors and their controls — a corner handle
 * beats the rotate band it sits inside, and a control handle beats everything.
 */
export function chromeAffordances(opts: ChromeAffordanceOptions = {}): Affordance[] {
  const sizes = targetSizesPx(opts.targetScale);
  const {
    handleHitRadius = sizes.handle,
    anchorHitRadius = sizes.anchor,
    rotateBandPx = sizes.rotationDistance,
    getAnchorState,
    rotationBadge,
    edgeHandles = true,
  } = opts;
  return [
    createRotationAffordance({
      bandPx: rotateBandPx,
      paint: null,
      ...(rotationBadge
        ? { handle: { distancePx: rotationBadge.distancePx, hitRadiusPx: rotationBadge.sizePx } }
        : {}),
    }),
    createCornerResizeAffordance({ handleHitRadius, edges: edgeHandles }),
    ...(getAnchorState
      ? createPathAnchorAffordances(getAnchorState, { hitRadius: anchorHitRadius })
      : []),
  ];
}

/**
 * Read anchor-editing state off a dep registry, for
 * {@link ChromeAffordanceOptions.getAnchorState}. Returns `null` while no
 * `editAnchors` dep is registered, so anchors are not hit-tested.
 */
export function anchorStateFrom(
  getRegistry: () => { get(name: 'editAnchors'): EditAnchorsDep | undefined } | null,
  /** The editable path in the world the hit-test is asked in. A node on a
   *  parallax plane stores its path in the plane's world; the surface carries
   *  it into the asking camera's. Default: unchanged. */
  toCamera?: (id: string, path: unknown) => unknown,
): () => AnchorState | null {
  return () => {
    const dep = getRegistry()?.get('editAnchors');
    if (!dep) return null;
    return {
      editingId: dep.editingId ?? null,
      // The hit-test reads world-coord anchor positions, so route through
      // `getEditablePath`: both pose-as-polygon and `data.path` consumers
      // resolve correctly.
      getPose: (id) => (toCamera ? toCamera(id, dep.getEditablePath(id)) : dep.getEditablePath(id)),
      getNode: (id) => dep.getNodeShape(id),
      ...(dep.extensions ? { extensions: dep.extensions } : {}),
      getOutline: (id) => {
        const path = dep.getOutlinePath?.(id) ?? dep.getEditablePath(id);
        return toCamera ? toCamera(id, path) : path;
      },
    };
  };
}

/**
 * Build the `affordanceAt` thunk for `useSceneGestureDispatcher`. The point is
 * **world-space**; callers convert from client coords first. Priority follows
 * the order of {@link chromeAffordances}, topmost first.
 */
export function buildAffordanceAt(
  opts: BuildAffordanceAtOptions,
): (worldPoint: WorldPoint) => AffordanceHit | null {
  const { getChromeState, getView, getIsVisible } = opts;
  const affordances = opts.affordances ?? chromeAffordances(opts);

  return function affordanceAt({ x: wx, y: wy }) {
    const hit = hitAffordanceRegions(
      affordances,
      wx,
      wy,
      getChromeState(),
      getView(),
      getIsVisible?.(),
    );
    return hit ? toAffordanceHit(hit) : null;
  };
}

/**
 * Region hit → `AffordanceHit`. The scratch fields named by
 * {@link CommonAffordanceScratch} are lifted onto the hit because the actions
 * that consume them read them there; the whole scratch rides along as `payload`.
 */
function toAffordanceHit(hit: AffordanceRegionHit): AffordanceHit {
  const scratch = (hit.binding.initialScratch ?? {}) as CommonAffordanceScratch;
  return {
    kind: hit.region.hitKind ?? `${hit.affordanceId}:${hit.regionId}`,
    owner: hit.affordanceId,
    strength: 'shared',
    ...(scratch.targetId !== undefined ? { targetIds: [scratch.targetId] } : {}),
    ...(scratch.anchor !== undefined ? { anchor: scratch.anchor } : {}),
    ...(scratch.fixedPoint !== undefined ? { fixedPoint: scratch.fixedPoint } : {}),
    ...(hit.cursor !== undefined ? { cursor: hit.cursor } : {}),
    ...(hit.binding.initialScratch !== undefined ? { payload: hit.binding.initialScratch } : {}),
  } as AffordanceHit;
}

/**
 * Classify a world-space point against the current selection: `'empty'`,
 * `'selected-body'`, or `'unselected-body'`.
 *
 * @param kindOfNode - Resolver from a hit node id to its semantic kind.
 *   Omitting it leaves `kind` undefined, which makes every `kind:` TargetSpec
 *   form no-match.
 * @param doubleClickNames - The node a double-click on a hit names
 *   (`doubleClickTarget`). Where that is another node, it rides along as
 *   `doubleClick`, classified the same way.
 */
export function buildClassifyTarget(
  getSelection: () => readonly string[],
  pickBest: (world: WorldPoint) => string | null,
  kindOfNode?: (id: string) => string | undefined,
  doubleClickNames?: (hitId: string) => string,
): (worldPoint: WorldPoint) => BodyClassification {
  return function classifyTarget(world) {
    const hitId = pickBest(world);
    if (!hitId) return { body: 'empty' };
    const sel = getSelection();
    const classify = (id: string) => ({
      body: sel.includes(id) ? 'selected-body' as const : 'unselected-body' as const,
      kind: kindOfNode?.(id),
      id,
    });
    const named = doubleClickNames?.(hitId);
    return named !== undefined && named !== hitId
      ? { ...classify(hitId), doubleClick: classify(named) }
      : classify(hitId);
  };
}

/** A registered layer's claim on a point, as the affordance the dispatcher
 *  routes: its kind names the layer, and it carries what the layer's hit-test
 *  resolved. */
export function layerAffordance(layerId: string, claim: LayerHit): AffordanceHit {
  return {
    kind: `layer:${layerId}`,
    owner: layerId,
    strength: claim.strength ?? 'shared',
    ...(claim.claimedKinds !== undefined ? { claimedKinds: claim.claimedKinds } : {}),
    ...(claim.cursor !== undefined ? { cursor: claim.cursor } : {}),
    ...(claim.initialScratch !== undefined ? { payload: claim.initialScratch } : {}),
  };
}
