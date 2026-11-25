I couldn't write `.skulk/out/findings.md`: creating it needed a permission that wasn't granted. As the brief allows, here is the whole document instead.

# labkit.annotations — round 50 findings

## A change in one target clears the store's redo list but leaves the other targets' scenes able to redo, so the lab's Redo and a pane's own Redo disagree
- where: packages/labkit/src/annotations/history.ts:64 (MarkHistory.observe)
- scenario: make a mark on target A and undo it, so A's scene can redo and `redoable` is `[A]`. Then make a mark on target B. `observe` sees a new change rather than a redo and sets `this.redoable = []`, but it never calls A's `history.dropRedo()`. The comment says "weasel's own scene did the same to its stack", which is true only of B's scene. Now `store.canRedo()` is false and the lab's Redo is disabled. A's pane still has core's default `redo` action bound to its keymap (`interactions/actions/defaults/undoRedo.ts`), so the same request can still bring back A's mark, landing it after B's in the order. `dropRedo()` exists to drop the scenes' redo too; `observe` should drop the other scenes' redo the same way.
- evidence: read (that the pane binds redo is inferred from core's default actions; I did not run it)
- severity: medium

## SVG export writes a `{ px }` stroke's dash in user units, so the dashes on a point ring and on an untitled text box come out `scale`× longer than on screen or in a PNG
- where: packages/labkit/src/annotations/svgNodes.ts:40 (toSvgStroke)
- scenario: export a stale point mark (stroke `width: { px: 2 }`, `dash: [6, 4]`) or an untitled text mark (`width: { px: 1 }`, `dash: [3, 3]`) as SVG at scale 4. `toSvgStroke` converts the `{ px }` width through `resolveScreenLength`, but copies `dash` unchanged into user units, and one user unit is `scale` output pixels. The ring comes out 0.5 units wide with dashes 24 px long. paint.ts:116 says dashes on a `{ px }` stroke are screen pixels. The renderer does that on screen and in the PNG path (`scaledDash` in `@weasel-js/paint`, used by renderer/src/strokeLengths.ts). The SVG path should scale the dash the same way.
- evidence: read
- severity: low

## Typing a mark's title in the Marks sidebar makes one undo step per keystroke
- where: packages/labkit/src/annotations/MarkList.tsx:50 (MarkList, title `Input` onChange)
- scenario: type "crack" into a mark's title. Each keystroke calls `marks.update(a.id, { title })` with no `coalesceKey`. `markWrites.update` runs one `scene.batch` per call, and batches only fold together when they share a key, so it takes five Undos to remove the title. The restyle palette does this the other way: `AnnotationOptions` passes a `coalesceKey` per gesture, so a burst of edits is one undo step.
- evidence: read
- severity: low

## A save in the legacy format, restored before its target has a content box, is never migrated, and its old `points` show through `get`/`query`
- where: packages/labkit/src/annotations/markScenes.ts:104 (openScene) with markShape.ts:25 (migrateLegacyPoints)
- scenario: some targets take their `content` from their element's size (the case `useTargetChanges` in AnnotationTargets.tsx exists for). Such a target reports 0×0 when `useTrialMarks` builds the store during the first render, before any ref attaches. `createMarkScenes` opens every restored scene immediately, `migrateLegacyPoints` sees zero content and returns `raw` unchanged, and the scene is cached, so nothing retries the migration once the content box is known. The mark keeps its old `data.points` and gets no `shape`:
  - `project` spreads `...data`, so `Annotation.points` is the old content-box array, which no longer follows `update({ frac })`.
  - paint.ts draws the line or stroke as the diagonal of its box.
- evidence: read
- severity: low

## Every trial's Export panel uses the same radio `name`s, so two open panels take each other's selected choice
- where: packages/labkit/src/annotations/ExportMenu.tsx:143 (ExportMenu, `name="lk-export-format"` / `name="lk-export-scale"`)
- scenario: a lab has two annotating trials, and each toolbar has its own `<ExportMenu>` (chrome/builtins.tsx:285). With both panels open, picking SVG in one makes the browser uncheck the other panel's radio, because they share a name in one document with no form around them. That panel's controlled `checked` state hasn't changed, so React doesn't restore it: it shows no format selected while its state still says PNG. `useId()` is already called in the component, for the title.
- evidence: read
- severity: low

## The restyle gesture counter starts again at 1 when the palette remounts, so a new restyle can merge into an older, unrelated undo step
- where: packages/labkit/src/annotations/AnnotationOptions.tsx:37 (useRestyleGesture)
- scenario: restyle a mark's width (key `restyle:1`). The lab chrome then remounts `AnnotationOptions`, which resets the ref. Later the user restyles the same mark again, with no other change on that scene in between. The key is `restyle:1` again. `scene.batch` folds a batch into the previous entry whenever the key matches and nothing came between (core/scene/recorder.ts `SceneBatchOptions`), with no time window, so one Undo removes both restyles.
- evidence: read
- severity: low

## The calibration instrument's map of picture refs gains an entry per trial and never loses one
- where: packages/labkit/src/annotations/calibration/calibrationInstrument.tsx:94 (calibrationInstrument, `pictures`)
- scenario: open and delete trials in a lab running the calibration instrument. `pictureFor` adds a `RefObject` for every trial id it is asked about and nothing ever deletes one, so for the instrument's whole life the map holds one entry for every trial that ever existed. It is a cache with no bound.
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

<!-- done: 7 findings, files read: 48 -->