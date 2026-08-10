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
import type { View } from 'core/viewport/view';
import type { AffordanceHit } from 'interactions/actions/invoker';
import { DEFAULT_ROTATION_HANDLE_DISTANCE } from 'interactions/actions/rotate/handle';
import type { Affordance, CommonAffordanceScratch } from 'affordances/types';
import { hitAffordanceRegions, type AffordanceRegionHit } from 'affordances/hitAffordanceRegions';
import { createCornerResizeAffordance } from 'affordances/cornerResize';
import { createRotationAffordance } from 'affordances/rotationHandle';
import { createPathAnchorAffordances, type AnchorState } from 'affordances/pathAnchors';
import { ANCHOR_HIT_BASE_PX, HANDLE_BASE_PX } from 'core/device/targets';

export type { AnchorState };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default hit-test radius for corner handles, in **screen** pixels. Mirrors
 *  DEFAULT_HANDLE_SIZE from SceneCanvas (8px CSS).
 *
 *  This used to be a world-unit radius, which every caller had to scale-correct
 *  by hand (`8 / meanScale(view.scale)`) or else watch the hit zone shrink
 *  under the visual handle at zoom > 1. Regions express hit radii in screen
 *  pixels and the framework converts, so the correction happens once, in the
 *  one place that knows the view. */
export const HANDLE_HIT_RADIUS = HANDLE_BASE_PX;

/** Hit-test radius for anchor and control-handle points, in screen pixels.
 *  Mirrors `useEditAnchors` default (`hitRadius = 8`). */
export const ANCHOR_HIT_RADIUS = ANCHOR_HIT_BASE_PX;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuildAffordanceAtOptions {
  /** Live ChromeState at call time — current selection plus effective bounds,
   *  including in-flight move/resize ghost poses. */
  getChromeState: () => ChromeState;
  /** Live view. Needed because region hit radii and the rotate band are
   *  declared in screen pixels and resolved against the current scale. */
  getView: () => View;
  /** Corner-handle hit radius in screen px. Default {@link HANDLE_HIT_RADIUS}. */
  handleHitRadius?: number;
  /** Anchor / control hit radius in screen px. Default {@link ANCHOR_HIT_RADIUS}. */
  anchorHitRadius?: number;
  /** Minimum rotate-band thickness outside the selection AABB, in screen px.
   *  Default {@link DEFAULT_ROTATION_HANDLE_DISTANCE}. */
  rotateBandPx?: number;
  /** Anchor-editing state. When omitted, anchors aren't hit-tested. */
  getAnchorState?: () => AnchorState | null;
  /** Chrome-caps resolver. Keeps the hit-test and the renderer agreeing on
   *  which chrome is live (resize handles gated by
   *  `'selection.resize-handles'`, rotation by `'selection.rotation-handle'`,
   *  anchors by `'path-edit.anchors'`). Omitting defaults to always-visible. */
  getIsVisible?: () => (id: string) => boolean;
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
  const {
    getChromeState,
    getView,
    handleHitRadius = HANDLE_HIT_RADIUS,
    anchorHitRadius = ANCHOR_HIT_RADIUS,
    rotateBandPx = DEFAULT_ROTATION_HANDLE_DISTANCE,
    getAnchorState,
    getIsVisible,
  } = opts;

  // Bottom → top. The rotate ring wraps the whole selection, so it sits under
  // the corner handles that punctuate it; anchors and their controls ride on
  // top of both, because in anchor-edit mode they're what the pointer is for.
  const affordances: Affordance[] = [
    createRotationAffordance({ bandPx: rotateBandPx, paint: null }),
    createCornerResizeAffordance({ handleHitRadius }),
    ...(getAnchorState
      ? createPathAnchorAffordances(getAnchorState, { hitRadius: anchorHitRadius })
      : []),
  ];

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
