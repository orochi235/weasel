import type { PointOrigin } from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import type { PathEditExtension, PathEditMark, PathEditStore } from 'features/paths/pathEditExtension';
import type { HandleLocks } from './edit-anchors/params';

/** An edit as {@link EditAnchorsDep.finishEdit} finishes it: the edited node's world path, and the other nodes' that move with it. */
export interface FinishedEditFrame {
  path: unknown;
  others: readonly { id: string; path: unknown }[];
}

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
   *  null if this node has no editable polygon. For a node whose path was
   *  drawn from a form a `PathRepresentation` reads, it is that form's edit
   *  path, which `applyEdit` turns back into the drawn path. Does NOT consult in-
   *  flight previews — callers that need live state read the dispatcher's
   *  in-flight handles. */
  getEditablePath(id: string): unknown;
  /** The drawn geometry, in world coordinates, whose outline is a segment press, where it
   *  differs from `getEditablePath`'s: a path drawn from a form. Absent, `getEditablePath`'s. */
  getOutlinePath?(id: string): unknown;
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
   *  `editAnchorSetTracked`), its per-anchor data (skin, vertex colors) is
   *  renumbered in that entry. The edit is finished first (see `finishEdit`); one an extension cannot
   *  finish commits nothing. */
  applyEdit(id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]): void;
  /** The ops `applyEdit` would commit for the same arguments, unapplied, so
   *  a caller can make the edit part of a larger batch — the pen joining
   *  two paths edits one node and deletes the other in one undo step.
   *  Optional; a caller that needs it declines the composite edit without
   *  it. Returns `[]` when `id` has no editable polygon, or when an
   *  extension cannot finish the edit. */
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

  /** The path-edit tool in use, or null for plain anchor editing — one of a
   *  set of named tools, such as `'simplifyBrush'`, that each change what a
   *  plain drag in path edit does. Always null with no path open. */
  tool: string | null;
  /** Switch path-edit tool, or pass null for plain anchor editing. */
  setTool(id: string | null): void;

  /** The handle locks held for every handle drag, on top of the modifiers —
   *  what the `handleLock.angle` and `handleLock.length` toggles set. Absent,
   *  the drag holds what its `handleLock` param names. Unlike the anchor
   *  selection, they outlast a change of edited path. */
  handleLocks?: HandleLocks;
  /** Replace the held handle locks. Absent, the toggles are unavailable. */
  setHandleLocks?(next: HandleLocks): void;

  /**
   * `worldPath`, an edit of `id`'s committed path, finished by every
   * extension's `finishEdit` in turn — path constraints made to hold, say —
   * with the paths of any other nodes that move with it. Null when one cannot
   * finish it, and the edit should then not happen. `applyEdit` and `editOps`
   * run it themselves; an ongoing edit calls it each frame so its preview is
   * what they will commit. Optional: absent, edits stand as they are.
   */
  finishEdit?(id: string, worldPath: unknown, origins?: readonly (PointOrigin | null)[]): FinishedEditFrame | null;
  /**
   * `ops`, a whole-node transform's batch — a move, resize, rotate, flip or
   * nudge — with the ops each extension's `finishTransform` adds after them:
   * the other nodes that change with the ones it transforms. Null when an
   * extension refuses the transform. The transform actions run it on the
   * batch they commit. Optional: absent, a transform commits as it is.
   */
  transformOps?(ops: readonly Op[], label: string): Op[] | null;
  /**
   * The other nodes a whole-node transform's frame changes, for a drag to
   * preview: given the stored poses the frame puts the transformed nodes in,
   * each other node's stored pose, and its data where that changes — what
   * `transformOps` would commit for the frame. Empty when nothing changes
   * with it. Optional.
   */
  transformPreview?(poses: ReadonlyMap<string, unknown>): readonly { id: string; pose: unknown; data?: unknown }[];
  /**
   * Commit `worldPath` for `id` with `data` laid over its data, as one
   * history entry, finished by no extension: what an extension writing its
   * own data with a path it already solved commits through. Optional.
   */
  store?: PathEditStore;
  /** The canvas's path-edit extensions, in order. */
  extensions?: readonly PathEditExtension[];
  /**
   * The extension mark selected in place of anchors, or null. Selecting one
   * clears the anchor selection and selecting anchors clears it, so Delete
   * acts on one or the other. Optional.
   */
  selectedMark?: PathEditMark | null;
  /** Select an extension's mark, or pass null to clear. */
  setSelectedMark?(mark: PathEditMark | null): void;
}
