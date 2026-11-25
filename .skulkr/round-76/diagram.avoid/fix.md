Non-finite box widens a drag frame's search limit (A): fixed 87b0cac799

Pathless connector's label placed on its stale route during commit (A): fixed 022585eda8

Split connector's label not an obstacle on the spec path (A): fixed 17854c499c

Spec path routes an edge with no facing port, scene path skips it (A): fixed a291bf37ea

Only an edge's first label is an obstacle (A): fixed f228c3f44e. Edges really can carry several labels (end labels). `AvoidEdge.label` became `labels`, a list, so the changeset is marked breaking.

Preview before any seed or commit routes nothing (A): fixed e63d21c833. With nothing committed, a preview now routes every connector against the obstacles it is given.

Locked connector's unstored route still in the committed state (A): fixed d3dcd48662

Drag frame's parent-local pose read as a world pose (B): fixed 2f3552bad9. `avoidSceneInput`'s third argument is now the frame's map of stored poses, folded through the containers above each node, so the changeset is marked breaking.

Descendants of a dragged container keep their old poses (B): fixed 2f3552bad9, the same fold as the finding above.

Locked connector rerouted on every edit (B): duplicate of the locked-connector finding from A (d3dcd48662). The router now takes `AvoidEdge.locked`, which `avoidSceneInput` sets. A locked connector is never rerouted or nudged, previews skip it, and it is rerouted on the next update once unlocked.

Non-finite drag frame box makes the window double ~1000 times (B): duplicate of the non-finite box finding from A (87b0cac799).

Spec and scene routing disagree on an end with no facing port (B): duplicate of the no-facing-port finding from A (a291bf37ea).

Extra: 726a4dbb52 only shortens four of my changeset titles that were over 140 characters. It fixes no defect.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: avoid.locked, dragIndex, router.preview, router.shrunk, router, sceneInput, specRoutes. All pass.
- Related files I didn't touch: edgeRoute, grid, router.pbt, router.model.pbt, avoid.follower, avoid.offPage, avoid.history, avoid.scene, diagramEditing. All pass.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run check:changesets`: pass ("OK — 827 changeset(s)"; none of the warnings are mine).
- `npm run check:size`: pass.
- `npm run lint -w @weasel-js/diagram`: cannot run, because the package has no `lint` script ("Missing script"). Instead I ran `npx eslint` on every changed `.ts` file: pass, exit 0.
- No browser test files were touched. The tree is clean.

tally: 12 of 12 fixed, 0 extra fixed