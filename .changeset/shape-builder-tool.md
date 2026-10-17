---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

`@weasel-js/path-tools` adds `useShapeBuilderTool` (Shift+M), which builds shapes from the faces two or more selected paths cut each other into. The face under the pointer is shown; a drag unites every face it passes through into one path standing in for the first face's source, so it wears that source's paint, and an Alt-drag deletes them instead, Alt being read live through the drag. A click takes a single face. Every face not taken becomes a path of its own, and each gesture is one undo step. With fewer than two paths selected, a drag marquee-selects. `mode: 'delete'` swaps the two, so a plain gesture deletes and Alt unites. It reads the `booleansAdapter` dep the Pathfinder actions use, and counts an unfilled stroke as the region it covers, as they do.

Core's `<SceneCanvas>` now publishes a `booleansAdapter` of its own over its path leaves (`data.path` drawn through the pose's box), so the Pathfinder actions and the shape builder work on a canvas whose consumer publishes none. A result is minted from the source it stands in for, keeping its layer, parent, frame, and data. A consumer's `useBooleansAdapter` under the canvas still replaces it — for text operands, which this one does not read. `useBooleansAdapterSource` is the hook behind it.

`planShapeBuilder(adapter, opts)` is the engine under it: the faces, `faceAt(x, y)`, and a `commit(picked, 'merge' | 'delete')` that writes the batch. `facesAlong(plan, run, step)` answers the faces a run of points passes through, in the order it enters them.

Core's `createPathOverlay({ id })` holds paths that are not nodes and gives a world-space `RenderLayer` drawing them over the scene, for a tool's `overlay` or a canvas's `layers`. Each path names a role, styled by `PATH_OVERLAY_ROLES` (`'chrome'`, `'picked'`, `'remove'`) or the caller's own.

`@weasel-js/geom` adds `pathFacePieces(...paths)`: `pathDividePieces` with a region that falls apart split into one piece per connected part.
