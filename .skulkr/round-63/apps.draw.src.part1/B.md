I couldn't save the full findings file: the last write was refused because permission wasn't granted. `.skulkr/out/findings.md` on disk has only the first two findings, so the complete document is below. One more thing: the frozen commit `1b4edb3a…` isn't in this repo (`git cat-file` reports a bad object), so these paths and line numbers refer to the working tree as it stands.

# Audit round 63 — apps.draw.src.part1 — blind reviewer findings

## A second Alt-click on a "Hidden"/"Collapsed" box in the surfaces editor hides (or collapses) every row instead of undoing the solo
- where: apps/draw/src/drawPrefsDialog.tsx:89 (SurfacesEditor `solo`)
- scenario: `soloChanges` (ui-input/src/solo.ts) was written for switches where on means shown. When the solo already holds, it turns every switch on, and that only undoes the first click if everything started on. `solo` passes it the `hidden`/`collapsed` flags instead, and those normally start all off.
  - Start with nothing hidden and Alt-click Hidden on one toolbar: that row is hidden and the others stay shown.
  - Alt-click the same box again: `soloed` is true, so every row's `hidden` becomes `true`. The tool palette, the status bar and every toolbar and panel disappear, instead of going back to nothing hidden.
  - The Collapsed column does the same thing: every panel collapses.
  - Fix: the second click should restore the pre-solo state (all off). Either invert before calling `soloChanges` (pass `!flag`, write back `!on`), or make its "back on" branch mean "flag off" here.
- evidence: read (drawPrefsDialog.tsx:89-95, packages/ui-input/src/solo.ts:11-22)
- severity: medium

## `carriedData` copies `pathEffect` onto the plain path a Pathfinder or outline result is minted as
- where: apps/draw/src/drawDocument.ts:75-84 (`CONTENT_KEYS` / `carriedData`), used by apps/draw/src/booleansAdapter.ts:58 and apps/draw/src/outlinesAdapter.ts:28,39
- scenario: `carriedData` says it keeps "everything but the content and the paint". But `CONTENT_KEYS` leaves out `pathEffect` (and `boolean`), and those keys are what give an effect node its geometry.
  - A path-effect node is a mark with no `data.path`; its shape comes from `data.pathEffect` through `derivePath`. It can be the source a result stands in for: the topmost operand of a Pathfinder op (read through `getOutline`), or the source of Create Outlines or Outline Stroke.
  - The result is minted as `pathNode(..., path, { ...carriedData(source.data), ... })`. That is a plain path that still holds `data.pathEffect` but has no `dependsOn` or `derivePath`.
  - `DRAW_NODE_ROUTING` (nodeKinds.ts:21-25) checks effect kinds before `path`, so the result is treated as an effect node. Properties titles it "Roughen" (for example), Layers names it after the effect (`effectNodeName`), and the path-effect settings form (`readPathEffectSettings`, via `pathEffectOf`) offers to edit an effect that no longer derives anything.
  - Fix: add `pathEffect` and `boolean` to `CONTENT_KEYS` so the result is an ordinary path.
- evidence: read (the key list and the routing). That an effect node actually reaches these adapters as a source depends on its painter answering `getOutline`; that part is inferred, not run.
- severity: medium

## Setting a swatch to None paints the selection from the paint editor but not from the None button or Shift-click
- where: apps/draw/src/ActiveSwatches.tsx:41-45 (`onToggleNone`, also `onSwap`)
- scenario: select a filled rectangle.
  - Open the fill chip's paint editor and choose None. `onChange('fill', null)` runs `paint()` and `edits.fill.commit({ paint: null })`, so the rectangle loses its fill as one undo entry.
  - Instead press the swatch's None button, or Shift-click the fill chip (packages/ui/src/components/FillStrokeSwatch/FillStrokeSwatch.tsx:78, 138). `onToggleNone` only calls `colors.setFocus` and `colors.toggleNone`, which change the active paint (tools/colorContext/ColorContextProvider.tsx:160-166). The rectangle keeps its fill while the swatch shows None.
  - So one path applies "fill = none" to the selection and the other doesn't. The file's own header says a chip edit paints "the active paint and, through setFill/setStroke, the selection".
  - Fix: send the toggled value through `edits[slot].commit`, as `onChange` does. Swap has the same gap: the swatch shows the paints swapped but the selection's paints stay as they were.
- evidence: read
- severity: low

## Files read
apps/draw/src/ActiveSwatches.tsx
apps/draw/src/App.tsx
apps/draw/src/CommandBar.stories.tsx
apps/draw/src/CommandBar.tsx
apps/draw/src/Editor.tsx
apps/draw/src/EditorStatusBar.tsx
apps/draw/src/LayersPanel.tsx
apps/draw/src/LoupeProvider.tsx
apps/draw/src/RightSidebar.tsx
apps/draw/src/Toolbar.tsx
apps/draw/src/Workspace.tsx
apps/draw/src/adapterPublishers.tsx
apps/draw/src/app.css
apps/draw/src/appCommands/actions.tsx
apps/draw/src/appCommands/depSchemaAugmentation.ts
apps/draw/src/appCommands/index.ts
apps/draw/src/booleansAdapter.ts
apps/draw/src/colorMode.tsx
apps/draw/src/constraintKeys.ts
apps/draw/src/docBackground.ts
apps/draw/src/docPersistence.ts
apps/draw/src/documentUnits.ts
apps/draw/src/drawDocument.ts
apps/draw/src/drawFeatures.ts
apps/draw/src/drawPrefsDialog.tsx
apps/draw/src/exportPage.ts
apps/draw/src/fileCommands.ts
apps/draw/src/fileNotices.ts
apps/draw/src/firstRunNotice.ts
apps/draw/src/fonts.ts
apps/draw/src/icons.gen.ts
apps/draw/src/icons.table.ts
apps/draw/src/loupePrefs.ts
apps/draw/src/main.tsx
apps/draw/src/menuBar.ts
apps/draw/src/menus.ts
apps/draw/src/newShapePaint.ts
apps/draw/src/nodeKinds.ts

<!-- done: 3 findings, files read: 38 -->