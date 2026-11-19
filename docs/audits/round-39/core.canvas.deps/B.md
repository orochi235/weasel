I couldn't write `.skulk/out/findings.md` because the write permission was declined, so the full document is below. The dixeram `take` tool isn't among my tools, so nothing was filed.

# Audit round 39: core.canvas.deps

## insertSite keeps a node on its page only when the parent is the page node itself, not a container on the page
- where: packages/core/src/canvas/deps/insertSite.ts:75 (insertSite)
- scenario: A paged scene has the pasteboard off. A group on page 1 is entered, so `insertInto` names it, and the user draws or pastes at a point off the page. `insertParent` returns the group. `sc.get(group).page` is undefined, so `pageId` is null and `ontoPage`/`keepOnPage` never runs. The node lands entirely off the page, which is what pasteboard-off is meant to prevent.
  - The guard `sc.get(site.parent)?.page === undefined` also leaves `pageIdOf`'s ancestor walk unused: it can only ever return the parent's own page.
  - The doc says "A node landing on a page with the pasteboard off is moved so part of it is on the page", and a node inside a group on a page is on that page.
  - 510b9682d9 added the guard to copy the older `placedPage(sc, site.parent)` check, which only matched page nodes, so nested parents have never been kept on the page.
- evidence: read (code, plus `git show` of 510b9682d9 and 43bf365638); not run
- severity: low

## The `kindOfNode` dep is documented as absent under `routing={[]}` but is always registered
- where: packages/core/src/canvas/deps/dispatchSources.ts:48 (useDispatchDepSources); the doc is at :18-20
- scenario: With `<SceneCanvas routing={[]}>`, the source `() => (id) => kindOfNode.current?.(id)` always returns a function. So `registry.get('kindOfNode')` is defined, and an action that `requires: ['kindOfNode']` (or checks whether the dep exists) runs and gets `undefined` for every id, against the documented contract that the dep is absent. The in-tree readers (`contextMenu.ts`) call `deps.kindOfNode?.(…) ?? fallback` and behave the same either way.
- evidence: read
- severity: low

## A held `editAnchors` dep checks and compares against the editing id it captured when it resolved
- where: packages/core/src/canvas/deps/editAnchors.ts:82-124 (the source's setEditingId, setSelectedAnchors, setSelectedMark, setMarquee)
- scenario: The file says a drag holds the dep from its press (see the `handleLocks` getter), but `effectiveId` is fixed when the dep resolves. Suppose edit mode exits, or moves to node B, during that drag (through a key binding, or an undo that removes the node).
  - The held dep's `setSelectedAnchors` and `setSelectedMark` still write node A's anchor indices into the shared state, which now belongs to B or to no node.
  - `setEditingId(A)` compares against the stale A and skips the anchor, mark, and marquee clear that "Anchor indices only mean something relative to one path" requires.
  - The fix is to read `state.getEditingId()` at call time, the way `handleLocks` reads `stateRef.current`.
- evidence: read; I didn't reproduce an editing-id change mid-gesture
- severity: low

## Files read
packages/core/src/canvas/deps/changes.ts
packages/core/src/canvas/deps/chromeRules.ts
packages/core/src/canvas/deps/colorAt.ts
packages/core/src/canvas/deps/debug.ts
packages/core/src/canvas/deps/dispatchSources.ts
packages/core/src/canvas/deps/dispatcher.ts
packages/core/src/canvas/deps/editAnchors.ts
packages/core/src/canvas/deps/enteredGroup.ts
packages/core/src/canvas/deps/geometryProjection.ts
packages/core/src/canvas/deps/hitTestArea.ts
packages/core/src/canvas/deps/index.ts
packages/core/src/canvas/deps/ingestion.ts
packages/core/src/canvas/deps/insertFactories.ts
packages/core/src/canvas/deps/insertParent.ts
packages/core/src/canvas/deps/insertSite.ts
packages/core/src/canvas/deps/inspection.ts
packages/core/src/canvas/deps/kitSettings.ts
packages/core/src/canvas/deps/layout.ts
packages/core/src/canvas/deps/modeDefaultTool.ts
packages/core/src/canvas/deps/nodeAtPoint.ts
packages/core/src/canvas/deps/operands.ts
packages/core/src/canvas/deps/pathEditCommits.ts
packages/core/src/canvas/deps/pathLeaf.ts
packages/core/src/canvas/deps/poseDescriptor.ts
packages/core/src/canvas/deps/previewPaths.ts
packages/core/src/canvas/deps/selectionSnapshot.ts
packages/core/src/canvas/deps/slice.ts
packages/core/src/canvas/deps/snap.ts
packages/core/src/canvas/deps/surface.ts
packages/core/src/canvas/deps/transformFollowers.ts
packages/core/src/canvas/deps/view.ts

<!-- done: 3 findings, files read: 31 -->