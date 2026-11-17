# Audit round 30 — diagrams (reviewer A)

## registerMarkShape({ geometry }) throws whenever any other mark painter is live, and offers no id to avoid it
- where: packages/diagram/src/marks.ts:81-110 (markShape, registerMarkShape); packages/core/src/canvas/nodeShapeRegistry.ts:119-127 (register)
- scenario: `markShape` hard-codes `id: 'diagram:mark'` and takes no `id` option. Since 42aab0cb66 the registry throws `ExtensionConflictError` when a different entry is registered under a live id. So a host that calls `registerMarkShape({ geometry: G })` while a `<DiagramView>` is mounted (which registers the cached default entry under the same id), or two components that each call `registerMarkShape({ geometry: G })` with the same `G` (each call builds a fresh entry), throws on the second registration. `registerDiagramShape` has the same failure for any two non-empty-option calls (a fresh entry each time, even for identical options) but at least offers `id`; `registerMarkShape` has no way out but `replace`, which it does not expose. Should: accept an `id` (as `DiagramShapeOptions` does) and/or reuse one entry per geometry.
- evidence: read
- severity: medium

## Page exports read the default background from the scene at call time, not from the revision they draw
- where: packages/diagram-formats/src/pageSvg.ts:49-50 (pageBackground), :74-99 (exportPageSvg, exportPagePng, exportPagesPdf)
- scenario: the exports are built to draw the document as it stands once loading finishes (`captureExport` re-reads regions per attempt; `pageSvg.revision.test.ts` moves a page mid-export and expects the moved bounds). The page color, though, is resolved once, synchronously, from `diagramThemeOf(scene)` before any await. A host that switches the diagram theme (writes `diagram:theme` and the restyled nodes) while a paint kind or font is still loading gets an SVG/PNG/PDF whose shapes are in the new theme on the old theme's page color. Should: resolve the default background inside the per-revision read (pass a function, or re-read the theme from the `doc` the capture hands over).
- evidence: read
- severity: low

## applyDiagramEdit ignores a Release members reported for a lane, so the lane comes back on the next build
- where: packages/diagram/src/applyEdit.ts:40-41, :94-107 (applyDiagramEdit, release); reported from packages/diagram/src/regionEditing.ts:73 (commitRelease)
- scenario: Release members is offered on a selected lane (`releasePlan` in containers/containerStencils.ts handles a lane: its members go past its pool and the lane is removed), and `DiagramView` reports it as `{ kind: 'release', id: <laneId> }`. `release()` looks the id up only among top-level `containers` (`containers.find((c) => c.id === id)`), never inside a pool's `lanes`, so for a lane it removes nothing and lifts nothing. A host following the documented `onEditContainer={(e) => setData((d) => applyDiagramEdit(d, { moves: [], routes: [], containers: [e] }))}` keeps the lane and its members in the data; the next `diagramScene` draws the lane again. Should: drop the lane from its pool's `lanes` (the pool's size follows) and hand its members to the pool's own parent region, as the scene does.
- evidence: read
- severity: medium

## A Diagram JSON file's theme object is taken unchecked, and a partial one crashes the import far from the reader
- where: packages/diagram-formats/src/jsonFormat.ts:24-42 (read); packages/diagram/src/theme/resolve.ts:60 (diagramThemeFrom)
- scenario: `DIAGRAM_JSON.read` checks pages but passes `theme` through as written. `diagramThemeFrom` accepts any object that has a `roles` key as a whole `DiagramTheme`. A `.diagram.json` holding `"theme": { "roles": {} }` (hand-edited, or from another tool) reads without error, and `documentSpecs` then throws a bare `TypeError` (`theme.font.family` in `themeFont`, `theme.label` in `roleEdgeStyle`) from inside `diagramScene`. The package already ships the checker for exactly this (`parseDiagramTheme`'s `checkTheme` in theme/themeFile.ts). Should: the reader refuses (or warns and drops) a theme object that does not check, as it refuses a bad page.
- evidence: read
- severity: low

## remeasureText writes locked nodes and throws, so a face landing in a scene with a locked layer aborts the remeasure
- where: packages/diagram/src/faceRemeasure.ts:34-50 (remeasureText), :58-74 (installFaceRemeasure); writes in packages/diagram/src/bodyRelayout.ts:125,129,135 (relayoutBodies) and sequence/commit.ts:71 (redrawSequences)
- scenario: the remeasure runs inside `sc.untracked(...)` only, not `scene.unlocked(...)`, and neither it nor `relayoutBodies`, the label-size loop, or `redrawSequences` skips locked nodes. The scene's lock guard throws `Scene: cannot … it is locked` on `update`/`setPose` of a locked node or one on a locked layer. With `useFaceRemeasure`/`installFaceRemeasure` mounted and any body, label or sequence on a locked layer, a lazily registered face landing throws from the queued microtask (an uncaught error), and every body, label and sequence after the locked one in render order stays sized for the fallback face. Should: run the writes under `scene.unlocked` (it restores a state the text already implies, like a replay), or skip locked nodes.
- evidence: read
- severity: medium

## applyDiagramTheme throws on a scene with any themed node on a locked layer, and the whole theme change is lost
- where: packages/diagram/src/theme/applyTheme.ts:44-52 (writeAll), :66-76 (applyDiagramTheme); packages/diagram/src/theme/themeWrites.ts (themeWrites, no lock check)
- scenario: `themeWrites` returns a write for every shape, connector, label, region and text node the theme recolors, locked or not, and `writeAll` calls `scene.update` on each. The lock guard throws on the first locked one, inside `scene.batch`, so picking a theme in a host whose user has locked a layer of the diagram (or locked one shape) fails with `Scene: cannot update "…" — it … is locked` and nothing is recolored, the `diagram:theme` value included. `redrawSequences` in the same batch has the same problem for a locked sequence root. Every other bulk writer in the package passes over locked nodes (`layoutWrites` filters `scene.isLocked`, `avoid/install.ts`, `labels/install.ts`, `offPage/install.ts`). Should: leave locked nodes as they are (or say in the docs that a theme needs every themed node unlocked and check up front).
- evidence: read
- severity: medium

## The once-per-name warning sets grow without bound for the life of the page
- where: packages/diagram/src/outlines/table.ts:28,47-55 (resolveOutline, `warned`); packages/diagram/src/unknownRefs.ts:5 (`warned`); packages/diagram/src/theme/resolve.ts:46 (`warnedThemeIds`)
- scenario: each keeps every distinct name it ever warned about in a module-level `Set` that is never trimmed. `resolveOutline`'s is not even dev-gated, so in production a host whose outline names come from its users (a shape's outline typed into a property field, outlines read from imported DOT `weasel_outline` attributes or draw-style styles) adds one entry per distinct unknown name it ever paints, for the life of the page; the other two do the same in development for every dangling id or misspelled theme an editing session passes through (data rebuilt per keystroke while an id is typed). Should: cap the sets (as `marks.ts`'s `PARSED` is capped at 256) or clear them.
- evidence: read
- severity: low

## DiagramView's onResize (and a resized region's box edit) reports the stored, parent-frame pose, where every other report and the data use world
- where: packages/diagram/src/diagramEditing.ts:88-106 (reportResizeAction); the poses come from packages/editing/src/actions/resize/frame.ts:101-133 (posesInBox, `storedPose`), passed by packages/editing/src/actions/resize/action.ts:66
- scenario: `createResizeAction`'s `commit` is handed each node's *stored* pose, which `diagramScene` keeps in its container's or lane's frame (`localizeWorldPoses`). `reportResizeAction` passes `x`/`y` straight through as `NodeResize` and as a region `box` edit. `onMove`, `diagramLayoutOf` and `readRegions` all report world (`worldWith`), and `applyNodeResizes` stores the report as the node's world `at`. So resizing a shape inside a container or lane at, say, world (300, 200) in a container at (250, 150) reports `x: 50, y: 50`; a host following the `onResize` docs (or `applyNodeResizes`) moves the shape to (50, 50) on the next build, out of its container. A container resized inside another container reports its box the same way. Top-level shapes are unaffected (stored = world). Should: report world poses (compose each through its parent, as `readScene` does).
- evidence: read
- severity: high

<!-- done: 8 findings, files read: 36 -->
