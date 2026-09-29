/**
 * affordanceAt — the dispatcher-side affordance classifier.
 *
 * Answers "what piece of selection chrome is under this world point?" and
 * returns an `AffordanceHit`, which `GestureDispatcherMounter` packs onto
 * `InputEvent.pointerdown.affordance` so `resizeAction` / `rotateAction` /
 * `editAnchorsAction` can guard on affordance kind, and which the hover-cursor
 * pump reads `cursor` off of.
 *
 * It used to answer that question with its own geometry: its own corner
 * table, its own rotate-ring ellipse, its own anchor walk — all duplicating
 * the `Affordance` region declarations in `src/affordances/`, which had a
 * hit-tester of their own that nothing reached for kit chrome. Two
 * implementations of one question, and the declarative one was the dead
 * branch, which is why `AffordanceRegion.cursor` could be declared and set
 * and never consumed.
 *
 * Now this assembles the kit's affordances and runs the one shared walk
 * (`hitAffordanceRegions`). What remains here is the assembly and the
 * region-hit → `AffordanceHit` mapping.
 */

import type { BodyClassification } from '@weasel-js/gestures';
import type { ChromeState } from 'core/selection/chromeState';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import type { View } from 'core/viewport/view';
import type { AffordanceHit } from '@weasel-js/routing';
import type { Affordance, CommonAffordanceScratch } from 'affordances/types';
import { hitAffordanceRegions, type AffordanceRegionHit } from 'affordances/hitAffordanceRegions';
import { createCornerResizeAffordance } from 'affordances/cornerResize';
import { createRotationAffordance } from 'affordances/rotationHandle';
import { createPathAnchorAffordances, type AnchorState } from 'affordances/pathAnchors';
import { targetSizesPx } from 'core/device/targets';

export type { AnchorState };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
 * badge), corner handles, then anchors and their controls — a corner handle
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
  } = opts;
  return [
    createRotationAffordance({
      bandPx: rotateBandPx,
      paint: null,
      ...(rotationBadge
        ? { handle: { distancePx: rotationBadge.distancePx, hitRadiusPx: rotationBadge.sizePx } }
        : {}),
    }),
    createCornerResizeAffordance({ handleHitRadius }),
    ...(getAnchorState
      ? createPathAnchorAffordances(getAnchorState, { hitRadius: anchorHitRadius })
      : []),
  ];
}

/**
 * Read anchor-editing state off a dep registry, for
 * {@link BuildAffordanceAtOpts.getAnchorState}. Returns `null` while no
 * `editAnchors` dep is registered — nothing is in anchor-edit mode, so
 * anchors are not hit-tested.
 */
export function anchorStateFrom(
  getRegistry: () => { get(name: 'editAnchors'): EditAnchorsDep | undefined } | null,
): () => AnchorState | null {
  return () => {
    const dep = getRegistry()?.get('editAnchors');
    if (!dep) return null;
    return {
      editingId: dep.editingId ?? null,
      // The hit-test reads world-coord anchor positions, so route through
      // `getEditablePath`: both pose-as-polygon and `data.path` consumers
      // resolve correctly.
      getPose: (id) => dep.getEditablePath(id),
    };
  };
}

/**
 * Build the `affordanceAt` thunk for `GestureDispatcherMounter`.
 *
 * Returns `(worldPoint) => AffordanceHit | null`. The point is **world-space**;
 * callers convert from client coords first.
 *
 * Priority runs anchors → controls → resize handles → rotate ring, top to
 * bottom, matching how the chrome paints: a corner handle beats the rotate
 * band it sits inside, and a control handle beats everything.
 */
export function buildAffordanceAt(
  opts: BuildAffordanceAtOptions,
): (worldPoint: { x: number; y: number }) => AffordanceHit | null {
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
 * Region hit → `AffordanceHit`.
 *
 * `hitKind` is the routing discriminator; the handful of scratch fields named
 * by {@link CommonAffordanceScratch} are lifted onto the hit because the
 * actions that consume them read them there. Everything else in scratch rides
 * along untouched as `payload`.
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
    ...(hit.region.cursor !== undefined ? { cursor: hit.region.cursor } : {}),
    ...(hit.binding.initialScratch !== undefined ? { payload: hit.binding.initialScratch } : {}),
  } as AffordanceHit;
}

// ---------------------------------------------------------------------------
// classifyTarget helper
// ---------------------------------------------------------------------------

/**
 * Classify a world-space point against the current selection:
 * - `'empty'`: no scene body hit.
 * - `'selected-body'`: hit a node that is currently selected.
 * - `'unselected-body'`: hit a node that is NOT selected.
 *
 * The caller supplies the hit-test function (already wired from
 * `useSceneSelectTool.pickEvery`).
 *
 * @param kindOfNode - Optional resolver from a hit node id to its semantic
 *   kind. `<SceneCanvas>` defaults it to the `data.kind` convention the kit
 *   already reads in `deps/textEdit` and the shape-tool inserts; consumers
 *   whose nodes name their kind elsewhere override it. Omitting it leaves
 *   `kind` undefined, which makes every `kind:` TargetSpec form no-match.
 */
export function buildClassifyTarget(
  getSelection: () => readonly string[],
  pickBest: (wx: number, wy: number) => string | null,
  kindOfNode?: (id: string) => string | undefined,
): (worldPoint: { x: number; y: number }) => BodyClassification {
  return function classifyTarget({ x: wx, y: wy }) {
    const hitId = pickBest(wx, wy);
    if (!hitId) return { body: 'empty' };
    const sel = getSelection();
    return {
      body: sel.includes(hitId) ? 'selected-body' : 'unselected-body',
      kind: kindOfNode?.(hitId),
    };
  };
}
