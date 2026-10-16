/** Path anchor, control-handle, segment, and balance-grip affordances. */

import type { CursorSpec } from '@weasel-js/cursor';
import type { Affordance, AffordanceBinding, AffordanceRegion, CommonAffordanceScratch } from './types';
import type { ChromeState } from 'core/selection/chromeState';
import { handleBalances, pathToAnchors, type AnchorSet, type PolygonPath } from '@weasel-js/geom';
import { enumerateAnchors } from 'interactions/actions/edit-anchors/geometry';

/**
 * Live anchor-editing state. The thunk that returns it is called on every
 * pointer event, so it must be cheap (O(1) field reads).
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

/** What an anchor hit hands to the action that follows. */
export interface AnchorScratch extends CommonAffordanceScratch {
  /** Node id of the path the anchor belongs to. */
  targetId: string;
  /** Sequential anchor index in path walk order. */
  anchorIndex: number;
  /** Which of the anchor's three grabbable points this is. */
  part: 'anchor' | 'controlIn' | 'controlOut';
}

/** Chrome-caps id gating the anchor, control, and segment affordances. */
export const PATH_ANCHOR_CHROME_ID = 'path-edit.anchors';

/** Chrome-caps id gating the balance grips, which the path-edit overlay draws
 *  under the same id. Off by default. */
export const PATH_BALANCE_CHROME_ID = 'path-edit.balance';

/**
 * Segment, balance-grip, anchor, and control affordances for the selected
 * paths, bottom → top.
 *
 * Three affordances rather than one, so that a control handle beats an anchor
 * regardless of which is nearer, the way controls draw on top, and both beat
 * the segment they sit on. Within each, nearest wins. A press on the edited
 * path's outline is a `segment` hit, which the segment bend binds to and a
 * selection move turns down. Anchors, controls, and segments share one id:
 * chrome-caps gates anchor editing as a single piece of chrome. Balance grips,
 * `balance:N` at the middle of each curved segment's handle-to-handle line,
 * have an id of their own so they can be shown apart from it.
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
    // Anchor coordinates are already world space, pose rotation baked in.
    // Anchoring to `null` keeps the framework from applying it twice.
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
        // only its own anchors may claim the press.
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

  const segments: Affordance = {
    id: PATH_ANCHOR_CHROME_ID,
    regions(state) {
      const editingId = getAnchorState()?.editingId ?? null;
      if (editingId === null) return [];
      const edited = editablePaths(state).find(({ id }) => id === editingId);
      if (!edited) return [];
      return [{
        id: `${editingId}:segment`,
        targetId: null,
        shape: { kind: 'outline', path: edited.path, hitRadiusPx: hitRadius },
        hitKind: 'segment',
        bind: (): AffordanceBinding => ({ initialScratch: { targetId: editingId } }),
      }];
    },
  };

  return [segments, balanceGrips(getAnchorState, hitRadius, cursor), anchors, controls];
}

/** A grip at the middle of each curved segment's balance line, on the path in
 *  edit mode while it is selected: `balance:N`, N the flat index of the
 *  segment's first anchor. */
function balanceGrips(
  getAnchorState: () => AnchorState | null,
  hitRadius: number,
  cursor: CursorSpec,
): Affordance {
  return {
    id: PATH_BALANCE_CHROME_ID,
    regions(state) {
      const anchorState = getAnchorState();
      const editingId = anchorState?.editingId ?? null;
      if (editingId === null || !(state.selection as readonly string[]).includes(editingId)) return [];
      const pose = anchorState!.getPose(editingId);
      if (!pose || (pose as { kind?: string }).kind !== 'polygon') return [];
      return handleBalances(pathToAnchors(pose as PolygonPath) as AnchorSet).map((line) => ({
        id: `${editingId}:balance:${line.flat}`,
        targetId: null,
        shape: { kind: 'point', x: line.grip.x, y: line.grip.y, hitRadiusPx: hitRadius },
        hitKind: `balance:${line.flat}`,
        cursor,
        bind: (): AffordanceBinding => ({ initialScratch: { targetId: editingId } }),
      }));
    },
  };
}
