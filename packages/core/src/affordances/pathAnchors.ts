/**
 * Path anchor + control-handle affordances.
 *
 * These were the last piece of selection chrome whose geometry lived only
 * inside `canvas/affordanceAt.ts`'s hand-written classifier. Expressing them
 * as regions puts every kit affordance behind one hit-test walk, which is
 * what lets `AffordanceRegion.cursor` and nearest-region picking apply here
 * too rather than only to the chrome that happened to be declarative already.
 */

import type { CursorSpec } from '@weasel-js/cursor';
import type { Affordance, AffordanceBinding, AffordanceRegion, CommonAffordanceScratch } from './types';
import type { ChromeState } from 'core/selection/chromeState';
import type { PolygonPath } from 'features/paths/types';
import { enumerateAnchors } from 'interactions/actions/edit-anchors/geometry';

/**
 * Live anchor-editing state, read fresh on every hit-test.
 *
 * Anchors are not derivable from `ChromeState` — they come off the editable
 * path behind whatever the consumer's `editAnchors` dep exposes — so this
 * thunk is the seam. It's called on every pointer event, so it must be cheap
 * (O(1) field reads); enumeration happens inside `regions()`.
 */
export interface AnchorState {
  /** Id of the path currently in anchor-edit mode, or `null`. Control handles
   *  are only hittable on the path that is being edited. */
  editingId: string | null;
  /** Current editable path for a node id. Non-polygon values are ignored. */
  getPose(id: string): unknown;
}

/** Options for the path-anchor affordances. */
export interface PathAnchorAffordanceOptions {
  /** Hit radius (screen-px) for anchor and control points. Default 8. */
  hitRadius?: number;
  /** Cursor while hovering an anchor or control. Defaults to `'pointer'`. */
  cursor?: CursorSpec;
}

/** What an anchor hit hands to the action that follows: which path, which
 *  anchor, and whether the grab was on the anchor itself or one of its two
 *  control points. */
export interface AnchorScratch extends CommonAffordanceScratch {
  /** Node id of the path the anchor belongs to. */
  targetId: string;
  /** Sequential anchor index in path walk order. */
  anchorIndex: number;
  /** Which of the anchor's three grabbable points this is. */
  part: 'anchor' | 'controlIn' | 'controlOut';
}

/** Chrome-caps id gating both returned affordances. */
export const PATH_ANCHOR_CHROME_ID = 'path-edit.anchors';

/**
 * Anchor + control affordances for the selected paths, bottom → top.
 *
 * Returns **two** affordances rather than one so that a control handle beats
 * an anchor regardless of which is nearer — the same preference `hitAnchor`
 * encodes, and the same one the rendering has (controls draw on top). Within
 * each of the two, nearest wins. They deliberately share one id: chrome-caps
 * gates anchor editing as a single piece of chrome, and splitting the id
 * would invent a visibility rule nothing asked for.
 *
 * Order matters — spread this into an affordance list in the returned order.
 */
export function createPathAnchorAffordances(
  getAnchorState: () => AnchorState | null,
  opts: PathAnchorAffordanceOptions = {},
): Affordance[] {
  const { hitRadius = 8, cursor = 'pointer' } = opts;

  /** Selected polygon paths, paired with their node id. */
  const editablePaths = (state: ChromeState): Array<{ id: string; path: PolygonPath }> => {
    const anchorState = getAnchorState();
    if (!anchorState) return [];
    const out: Array<{ id: string; path: PolygonPath }> = [];
    for (const id of state.selection) {
      const pose = anchorState.getPose(id);
      if (!pose || (pose as { kind?: string }).kind !== 'polygon') continue;
      out.push({ id, path: pose as PolygonPath });
    }
    return out;
  };

  const point = (
    id: string,
    targetId: string,
    x: number,
    y: number,
    scratch: AnchorScratch,
    hitKind: string,
  ): AffordanceRegion => ({
    id,
    // Anchor coordinates are already in the path's own space, which for an
    // editable path is world space — the pose rotation that `targetId` would
    // introduce is baked into the coords. Anchoring to `null` keeps the
    // framework from applying it twice.
    targetId: null,
    shape: { kind: 'point', x, y, hitRadiusPx: hitRadius },
    hitKind,
    cursor,
    bind: (): AffordanceBinding => ({ initialScratch: { ...scratch, targetId } }),
  });

  const anchors: Affordance = {
    id: PATH_ANCHOR_CHROME_ID,
    regions(state) {
      const editingId = getAnchorState()?.editingId ?? null;
      const out: AffordanceRegion[] = [];
      for (const { id, path } of editablePaths(state)) {
        // `editAnchorsAction` edits whatever path the dep says is in edit
        // mode, ignoring which one was hit — so once a path IS being edited,
        // only its own anchors may claim the press. The overlay paints only
        // that path's anchors too.
        if (editingId !== null && id !== editingId) continue;
        for (const a of enumerateAnchors(path)) {
          out.push(point(
            `${id}:anchor:${a.anchorIndex}`,
            id, a.x, a.y,
            { targetId: id, anchorIndex: a.anchorIndex, part: 'anchor' },
            `anchor:${a.anchorIndex}`,
          ));
        }
      }
      return out;
    },
  };

  const controls: Affordance = {
    id: PATH_ANCHOR_CHROME_ID,
    regions(state) {
      const anchorState = getAnchorState();
      const editingId = anchorState?.editingId ?? null;
      if (editingId === null) return [];
      const out: AffordanceRegion[] = [];
      for (const { id, path } of editablePaths(state)) {
        // Controls are grabbable only on the path actually in edit mode.
        if (id !== editingId) continue;
        for (const a of enumerateAnchors(path)) {
          if (a.controlIn) {
            out.push(point(
              `${id}:controlIn:${a.anchorIndex}`,
              id, a.controlIn.x, a.controlIn.y,
              { targetId: id, anchorIndex: a.anchorIndex, part: 'controlIn' },
              `controlIn:${a.anchorIndex}`,
            ));
          }
          if (a.controlOut) {
            out.push(point(
              `${id}:controlOut:${a.anchorIndex}`,
              id, a.controlOut.x, a.controlOut.y,
              { targetId: id, anchorIndex: a.anchorIndex, part: 'controlOut' },
              `controlOut:${a.anchorIndex}`,
            ));
          }
        }
      }
      return out;
    },
  };

  return [anchors, controls];
}
