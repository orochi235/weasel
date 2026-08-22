---
'@weasel-js/labkit': patch
---

Reorderable workspaces, and tile extents that survive a reload

`WorkspaceGrid` gains four props. `reorderable` (off by default) renders a
drag handle per tile and reports the order a drop would produce through
`onReorder` — the grid never reorders `children` itself, so the caller stays
the owner of the list. `layout` / `onLayoutChange` carry per-tile extents:
hand the last value back as `layout` and a dragged seam survives a reload.
Both key off `ids`, and neither does anything without it.

`<Lab>` wires all four. Workspace order and tile extents now persist
alongside workspaces, snapshots, and theme, under a new `layout` storage key.

Also new: `reorderWorkspaces(workspaces, ids)` in the workspace ops, and
`reorderWorkspaces` on the lab context.
