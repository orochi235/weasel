# text-dom findings

## A node-level `{ px }` letterSpacing is resolved at scale 1, so the overlay tracks it at px × zoom while the canvas tracks it at px
- where: packages/text-dom/src/useTextEdit.ts:126 (useTextEdit effect, `resolveTextStyle(carried?.held ?? getStyle(editingId), getPaint?.(editingId))`)
- scenario: node style `{ fontSize: 16, letterSpacing: { px: 5 } }` edited at view zoom 2, with the host passing `zoom: 2` (or omitting zoom with `fontSize: 32`). The canvas resolves the style at the view scale (`textPoseLayout.ts:44` passes `scale`), so it lays out 2.5 world units, which is 5 screen px. The overlay resolves with no scale (the default `1`), so `style.letterSpacing` is 5 world units. `typeset` (overlayPlace.ts:107-109) then writes `5px`, which the zoom transform draws as 10 screen px; on the no-zoom path `scale = pose.fontSize / style.fontSize = 2` also writes 10px. Either way the overlay tracks twice as wide as the canvas, and wrapped lines break at different places. It should resolve at `pose.pxScale ?? pose.zoom` the way runs' `{ px }` sizes do through `ZOOM_PROPERTY`. `restyleNode` (heldNodeStyle.ts:37) has the same unscaled call.
- evidence: read (resolveTextStyle's `scale = 1` default and `resolveScreenLength(s.letterSpacing, scale)` at textStyle.ts:224/268; test at textStyle.test.ts:164)
- severity: medium
- fix: packages/text-dom/src/useTextEdit.ts, packages/text-dom/src/heldNodeStyle.ts, packages/text-dom/src/overlayPlace.ts
- size: function
- cause: node style resolved without the view scale
- confidence: likely

## Text typed outside any run span in a small-caps node is never split into small-caps pieces
- where: packages/text-dom/src/domRuns.ts:355 (normalizeSmallCaps, `visit` for non-run elements)
- scenario: a node whose style is `fontVariantCaps: 'small-caps'`, in a face with no small caps of its own, is seeded as one `<span data-run>`. The user selects all and types. The selection is not collapsed, so `onBeforeInput` leaves the insert to the browser (overlayTyping.ts:117-118). The browser deletes the span and puts the new text straight into the overlay root, or into a span of its own with no `data-run`. `normalizeSmallCaps` only rewrites inside `data-run` spans. Outside them it just adds the text to `before`, so those lowercase letters keep the browser's synthesized small caps (the root's `font-variant`) at the browser's own scale, not `smallCapsScaleFor`. The overlay then no longer matches the canvas until something rewrites the runs. The comment at domRuns.ts:207 expects "the next normalize" to fix such letters, but for text outside a run span it never does.
- evidence: read
- severity: low
- size: function
- cause: normalize skips text not inside a run span
- confidence: likely

## `makeHarness` stores texts in a plain object, so an id like `__proto__` never commits
- where: packages/text-dom/src/testing/textEditHarness.ts:8 (makeHarness)
- scenario: `texts` is `{ ...initial }`, so it has a prototype. `setText('__proto__', 'x')` runs the `__proto__` setter, which ignores a string, so `texts` gets no own key. After that `getText` and `getScreenPose` (which check `Object.hasOwn`) answer `''` and `null` for that id, and a test of prototype-named ids gives a false failure. `makeRichHarness` beside it already uses `Object.create(null)` for exactly this reason.
- evidence: read
- severity: low
- size: line
- cause: user-keyed table with a prototype
- confidence: sure

## Files read
packages/text-dom/src/armedStyle.ts
packages/text-dom/src/domOffsets.ts
packages/text-dom/src/domRuns.ts
packages/text-dom/src/editOverlay.ts
packages/text-dom/src/editSession.ts
packages/text-dom/src/heldNodeStyle.ts
packages/text-dom/src/index.ts
packages/text-dom/src/overlayBaseline.ts
packages/text-dom/src/overlayCarry.ts
packages/text-dom/src/overlayDirection.ts
packages/text-dom/src/overlayDraft.ts
packages/text-dom/src/overlayEdits.ts
packages/text-dom/src/overlayFollow.ts
packages/text-dom/src/overlayFrame.ts
packages/text-dom/src/overlayHistory.ts
packages/text-dom/src/overlayListeners.ts
packages/text-dom/src/overlayOpen.ts
packages/text-dom/src/overlayPlace.ts
packages/text-dom/src/overlayScroll.ts
packages/text-dom/src/overlaySeed.ts
packages/text-dom/src/overlaySelection.ts
packages/text-dom/src/overlayStyle.ts
packages/text-dom/src/overlayTyping.ts
packages/text-dom/src/pasteRuns.ts
packages/text-dom/src/pbt.fixture.ts
packages/text-dom/src/publishedRange.ts
packages/text-dom/src/runSplice.ts
packages/text-dom/src/runStyle.ts
packages/text-dom/src/selectionStyling.ts
packages/text-dom/src/styleShortcuts.ts
packages/text-dom/src/testing/baselineDrop.ts
packages/text-dom/src/testing/overlayDirection.ts
packages/text-dom/src/testing/overlayReady.ts
packages/text-dom/src/testing/textEditHarness.ts
packages/text-dom/src/textEditTypes.ts
packages/text-dom/src/useTextEdit.ts

<!-- done: 3 findings, files read: 36 -->
