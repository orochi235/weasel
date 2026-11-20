# labkit.annotations — blind review, round 50

## The SVG export copies a `{ px }` stroke's dashes as user units, so they scale with the export where the pane and the raster export keep them in screen pixels
- where: packages/labkit/src/annotations/svgNodes.ts:40 (toSvgStroke)
- scenario: a stale point mark (stroke `width: { px: 2 }`, `dash: [6, 4]`) or an untitled text box (`width: { px: 1 }`, `dash: [3, 3]`) exported with `capture(t, { format: 'svg', scale: 4 })`, or as PNG over an SVG base. `toSvgStroke` resolves the width through `resolveScreenLength(…, scale)` but copies `dash` verbatim, so in the marks `<svg>` (viewBox = content box, outer width = content × scale) the dashes come out 24/16 output px. The renderer (`resolveStrokeLengths` in packages/renderer/src/strokeLengths.ts, the raster-stack route through `renderSceneToPixels`) resolves a `{ px }` stroke's dashes against the scale, so the same mark exported as PNG with no base draws 6/4 px dashes. The dash should be divided by `scale` when the width is `{ px }` (`scaledDash`).
- evidence: read
- severity: low

## Restyling a selection that spans targets or trials lands one undo step per target, not one per burst
- where: packages/labkit/src/annotations/AnnotationOptions.tsx:100 (selectionBar onChange)
- scenario: with Select active, marks selected in two targets (a `'per-target'` store, or two trials whose stores each hold a selection, which `selectedMarks` gathers "in any trial"). Dragging the palette's Width slider calls `store.update(id, { width }, { coalesceKey })` per mark. The key only folds updates inside one scene's history, and each target has its own scene, so the burst becomes one entry per target (each stamped separately by `MarkHistory.observe`). One Undo takes back the width on one target only and leaves the other restyled; `useRestyleGesture`'s own contract is "one undo step per burst of edits to one field of one selection". Should commit the burst as one step across scenes, or the ordering should group entries sharing the gesture.
- evidence: read
- severity: medium

## `AnnotationOverlayProps.scene` documents a shared scene separated by each mark's `target` field, but every target has its own scene
- where: packages/labkit/src/annotations/AnnotationOverlay.tsx:32 (AnnotationOverlayProps)
- scenario: a host mounting `<AnnotationOverlay>` itself reads "The trial's mark scene — shared by every target; a mark's own `target` field is what separates them" and passes one scene to several overlays. Hit-testing, marquee and paint walk the whole scene, so every pane then picks and draws the other panes' marks — exactly what `createMarkStore`'s docstring says one scene per target exists to prevent. `AnnotationTargets` passes `annotations.openScene(t.id)`; the doc should say the scene is this target's own.
- evidence: read
- severity: low

## Typing a mark's title in `<MarkList>` lands one undo step per keystroke
- where: packages/labkit/src/annotations/MarkList.tsx:50 (MarkList, title Input onChange)
- scenario: type "crack" into a row's Title field. React Aria's `TextField` fires `onChange` per keystroke, and each calls `marks.update(a.id, { title })` with no `coalesceKey`; mark scenes are made with no `coalesceWindowMs` (`createMarkScene`, history default 0), so nothing folds them. The trial's history gets five entries and Undo takes back one letter at a time. The lab rule is that a burst of edits to one control is one step, and `AnnotationOptions` already does this for its restyles with `{ coalesceKey }`; the title (and the status select) should pass one per field burst too.
- evidence: read
- severity: medium

## A new mark change clears the ordering's redo for every target but leaves the other targets' scenes holding theirs, so a pane's own Redo brings back a change the store says is gone
- where: packages/labkit/src/annotations/history.ts:64 (MarkHistory.observe)
- scenario: draw a1 on target A, b1 on target B; `store.undo()` takes back b1 (redoable `[B]`, scene B can redo). Draw a2 on A: `observe` sees a non-redo change and sets `this.redoable = []`, but only scene A's own stack dropped its redo; scene B still holds b1. `store.canRedo()` is now false and `store.dropRedo()` (which walks only targets named in `this.redoable`) can no longer reach B. Focus pane B and press its own Redo keybinding (the case this class's doc names: an undo "driven from inside a pane's own keymap"): scene B redoes b1, `observe` reads it as a redo (b1's id is in `ahead`), finds nothing to `drop`, and pushes it with a fresh stamp — b1 reappears after a2, a redo the cross-target ordering had discarded. The branch that clears `this.redoable` should also call `dropRedo` on every other target's scene that still `canRedo()`.
- evidence: read
- severity: medium

## A target the instrument no longer (or not yet) declares reads as a 0×0 content box, so its kept marks report all-zero positions and a geometry write collapses them to the origin
- where: packages/labkit/src/annotations/store.ts:83 (contentOf), used by markReads.ts:45 (project) and markWrites.ts:41/53 (add, update)
- scenario: `liveTargets()` deliberately keeps listing the marks of a target "the instrument has since stopped declaring, so its marks are not lost" (the capability's `targets(state, config, trial)` is state-dependent and re-read on every call through `useTrialMarks`). For such a target `contentOf` returns `NO_CONTENT`, and `worldToFrac` turns every zero side into 0, so `query()`, `get()`, `hitTest()` and the `<MarkList>` row report `frac: {0,0,0,0}` and every `points` entry at (0, 0) — the position is not lost in the scene but every read says it is. Writes are worse: `update(id, { points })` or `{ frac }` on such a mark runs `fracToWorld(bounds, 0×0)` and `setPose`s a zero rect, destroying the stored geometry; `add({ target })` for a target not declared yet stores a zero pose for whatever `frac` it was given. Reads should keep the last known content box per target (or skip conversion), and writes against an undeclared target should be refused like an unknown id.
- evidence: read
- severity: medium

## `calibrationInstrument` keeps a picture ref for every trial id it has ever rendered, never dropping one
- where: packages/labkit/src/annotations/calibration/calibrationInstrument.tsx:94 (pictures / pictureFor)
- scenario: a lab running the calibration instrument where trials are opened and deleted repeatedly: each new trial id adds a `RefObject` to `pictures`, and nothing removes it when the trial goes, so the map grows for the instrument's life (one entry per trial ever shown). Small per entry, but it is a cache with no bound; the entry should be released when the trial unmounts.
- evidence: read
- severity: low

## Choosing "—" in `<MarkList>`'s status select stores `status: ''` rather than clearing it, so "no status" has two representations
- where: packages/labkit/src/annotations/MarkList.tsx:59 (status select onChange)
- scenario: give a mark status `confirmed`, then pick "—": `marks.update(id, { status: '' })` stores the empty string. A mark that never had a status has `status: undefined`. `query({ status: … })` has no single value matching "no status" across both, `toJSON` persists `""`, and a host reading `a.status !== undefined` to decide whether a mark is classified counts the cleared one as classified. The "—" choice should patch `status: undefined`.
- evidence: read
- severity: low

## Every API write snaps a mark's world pose to 1/10,000 of the content box, so on a large target `add` and `update` move marks by whole pixels
- where: packages/labkit/src/annotations/markWrites.ts:35 and :54 (add, update via roundFrac)
- scenario: a target whose content box is 60,000 × 2,000 (a long trace or a stitched image). `add({ frac })` and `update(id, { frac | points })` round the fraction to 4dp before `fracToWorld`, so the stored pose lands on a 6-unit grid horizontally (0.2 vertically): a mark placed by `add` at world x = 12,345 is stored at 12,342 or 12,348, and nudging it through `update` can only move it in 6-unit steps. Marks drawn by the pane's own tools write world poses directly and are not snapped, so the same mark is exact when drawn and shifts by up to 3 units the first time any `update` touches its geometry. The 4dp rounding is justified for the human-diffed stored document, but the scene stores world units; rounding should apply to what is reported (or to the serialized form), not to the pose written into the scene.
- evidence: read
- severity: low

## Files read
packages/labkit/src/annotations/AnnotationOptions.less
packages/labkit/src/annotations/AnnotationOptions.stories.tsx
packages/labkit/src/annotations/AnnotationOptions.tsx
packages/labkit/src/annotations/AnnotationOverlay.tsx
packages/labkit/src/annotations/AnnotationTargets.tsx
packages/labkit/src/annotations/Annotations.less
packages/labkit/src/annotations/AnnotationsContext.ts
packages/labkit/src/annotations/ExportMenu.tsx
packages/labkit/src/annotations/MarkList.tsx
packages/labkit/src/annotations/calibration/Calibration.less
packages/labkit/src/annotations/calibration/Calibration.stories.tsx
packages/labkit/src/annotations/calibration/CalibrationPicture.tsx
packages/labkit/src/annotations/calibration/CalibrationResults.tsx
packages/labkit/src/annotations/calibration/calibrationInstrument.tsx
packages/labkit/src/annotations/calibration/condition.ts
packages/labkit/src/annotations/calibration/exercises.ts
packages/labkit/src/annotations/calibration/score.ts
packages/labkit/src/annotations/capture.ts
packages/labkit/src/annotations/drawOne.ts
packages/labkit/src/annotations/frac.ts
packages/labkit/src/annotations/history.ts
packages/labkit/src/annotations/index.ts
packages/labkit/src/annotations/labMarkStores.ts
packages/labkit/src/annotations/labMarks.ts
packages/labkit/src/annotations/markData.ts
packages/labkit/src/annotations/markId.ts
packages/labkit/src/annotations/markReads.ts
packages/labkit/src/annotations/markScenes.ts
packages/labkit/src/annotations/markShape.ts
packages/labkit/src/annotations/markTools.ts
packages/labkit/src/annotations/markWrites.ts
packages/labkit/src/annotations/options.ts
packages/labkit/src/annotations/overlayCanvas.ts
packages/labkit/src/annotations/overlayPlacement.ts
packages/labkit/src/annotations/overlayTile.ts
packages/labkit/src/annotations/paint.ts
packages/labkit/src/annotations/preload.ts
packages/labkit/src/annotations/query.ts
packages/labkit/src/annotations/saveCapture.ts
packages/labkit/src/annotations/selectionStyle.ts
packages/labkit/src/annotations/staleness.ts
packages/labkit/src/annotations/store.ts
packages/labkit/src/annotations/svgNodes.ts
packages/labkit/src/annotations/toolMap.ts
packages/labkit/src/annotations/types.ts
packages/labkit/src/annotations/useLabToolOptions.ts
packages/labkit/src/annotations/view.ts
packages/labkit/src/annotations/wheelScroll.ts

<!-- done: 9 findings, files read: 48 -->
