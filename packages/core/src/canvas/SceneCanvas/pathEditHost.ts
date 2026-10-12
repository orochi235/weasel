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
}
