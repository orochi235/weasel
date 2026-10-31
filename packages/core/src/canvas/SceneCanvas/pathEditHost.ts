/**
 * A host that owns which path is being anchor-edited, for `<SceneCanvas pathEdit>`. Given one,
 * the canvas keeps no id of its own: it reads `editingId()` wherever it needs the open path, and
 * the `enterPathEdit` and `exitPathEdit` actions call `setEditingId`. For a host whose own state
 * already says which path is open, such as a mode machine holding a path-edit mode's target.
 *
 * The host asks for a redraw when its answer changes; passing its store in `redrawOn`, or its
 * registry in `modes`, does.
 */
export interface PathEditHost {
  /** The node whose anchors are editable now, or null for none. */
  editingId(): string | null;
  /** The canvas asking to open `id` for editing, or with null to close the open one. */
  setEditingId(id: string | null): void;
  /**
   * The selected anchors of the open path, as flat anchor indices, for a host that owns the
   * anchor selection too, so it can seed one and show what is selected. Give both or neither;
   * without them the canvas keeps its own.
   */
  selectedAnchors?(): ReadonlySet<number>;
  /** The canvas changing the anchor selection: a click, a marquee, an edit that
   *  renumbers anchors, or a path opening or closing. */
  setSelectedAnchors?(next: ReadonlySet<number>): void;
}

/** A path a canvas opens in anchor edit as it mounts (`defaultPathEdit`), as though it had been
 *  double-clicked: `id` must be selected, as an edit target always is. */
export interface PathEditOpening {
  id: string;
  /** Flat indices of the anchors to select in it. */
  anchors?: readonly number[];
}
