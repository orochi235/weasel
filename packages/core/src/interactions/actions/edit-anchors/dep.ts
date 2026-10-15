import type { PathConstraint, PointOrigin } from '@weasel-js/geom';
import type { Op } from 'core/ops/types';

/**
 * Adapter dep for `editAnchorsAction`: narrow read/write access to the
 * editable polygon of a single node, so anchor-edit actions need not know
 * whether it lives directly on the node's pose (`pose.kind === 'polygon'`)
 * or on `node.data.path`.
 *
 * In-flight edit state is surfaced through the dispatcher's
 * `OngoingHandle.previewIds/previewPose/previewData` triple, not this dep.
 */
export interface EditAnchorsDep {
  /** Id of the node currently being edited. Empty string means no node is
   *  currently in edit mode — the chrome and gesture both opt out. */
  editingId: string;
  /** Enter/exit edit mode for a specific node. Pass `null` (or an empty
   *  string) to exit. */
  setEditingId(id: string | null): void;
  /** Returns the COMMITTED editable polygon in world coordinates, or
   *  null if this node has no editable polygon. Does NOT consult in-
   *  flight previews — callers that need live state read the dispatcher's
   *  in-flight handles. */
  getEditablePath(id: string): unknown;
  /** Returns where the polygon is stored — `'pose'` when `node.pose`
   *  IS the polygon, `'data'` when it lives on `node.data.path` with a
   *  rect pose, or `null` when the node has no editable polygon. */
  getStorageKind(id: string): 'pose' | 'data' | null;
  /** Returns the node's raw `pose` and `data` so storage-aware actions
   *  can capture origin state at gesture-start and synthesize a matching
   *  `previewPose` / `previewData` during `onMove`. Returns null when the
   *  node is gone. */
  getNodeShape(id: string): { pose: unknown; data: unknown } | null;
  /** Commit `worldPath` as the new value for `id`, as one history entry
   *  labeled `label`: a setPose when the pose IS the polygon, a batched
   *  setPose+update when it lives on data.path. Given `origins` (from
   *  `editAnchorSetTracked`), a `data.skin` is renumbered in that entry,
   *  and so are `data.constraints`. The node's constraints are made to hold
   *  first (see `constrainEdit`); an edit they cannot survive commits
   *  nothing. */
  applyEdit(id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]): void;
  /** The ops `applyEdit` would commit for the same arguments, unapplied, so
   *  a caller can make the edit part of a larger batch — the pen joining
   *  two paths edits one node and deletes the other in one undo step.
   *  Optional; a caller that needs it declines the composite edit without
   *  it. Returns `[]` when `id` has no editable polygon, or when its
   *  constraints cannot hold after the edit. */
  editOps?(id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]): Op[];

  /**
   * Anchors currently selected within the edited path, as **flat anchor
   * indices** — the same numbering `enumerateAnchors` produces and the
   * `anchor:N` affordance kinds carry.
   *
   * Selection is transient UI state, deliberately not part of the scene:
   * it is cleared whenever `editingId` changes, and any edit that
   * renumbers anchors (insert, delete) is responsible for leaving it
   * coherent. Empty means "no anchor selected" — the keyboard actions
   * (nudge, delete) no-op rather than acting on all anchors.
   */
  selectedAnchors: ReadonlySet<number>;
  /** Replace the anchor selection. Pass an empty iterable to clear. */
  setSelectedAnchors(next: Iterable<number>): void;

  /** In-flight anchor-marquee rect in world coords, or null when no
   *  marquee drag is active. */
  marquee: { x: number; y: number; width: number; height: number } | null;
  /** Set or clear the in-flight marquee rect. */
  setMarquee(rect: { x: number; y: number; width: number; height: number } | null): void;
  /**
   * `worldPath`, an edit of `id`'s committed path, finished so the node's
   * constraints hold: the anchors the edit moved stay put where they can, and
   * the rest move the least they must (see `constrainPathEdit`). Null when the
   * constraints cannot hold after this edit, which should then not happen.
   * `applyEdit` and `editOps` run it themselves; an ongoing edit calls it
   * each frame so its preview is what they will commit. Optional: absent,
   * paths edit unconstrained.
   */
  constrainEdit?(id: string, worldPath: unknown, origins?: readonly (PointOrigin | null)[]): unknown;
  /**
   * Replace `id`'s constraints with `constraints` as one history entry
   * labeled `label`, moving its path the least that makes them all hold. When
   * they cannot all hold the path stays as it is and the list is stored all
   * the same, the conflict left for the anchor overlay to show; the answer
   * names the constraints that do not hold, by index. Optional.
   */
  setConstraints?(id: string, constraints: readonly PathConstraint[], label: string): readonly number[];
  /**
   * Index into the edited node's constraints of the one whose mark was
   * clicked, or null. Selecting one clears the anchor selection and
   * selecting anchors clears it, so Delete acts on one or the other;
   * `setConstraints` clears it too, since it renumbers the list. Optional.
   */
  selectedConstraint?: number | null;
  /** Select a constraint by index, or pass null to clear. */
  setSelectedConstraint?(index: number | null): void;
}
