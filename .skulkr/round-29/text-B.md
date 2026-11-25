# Audit 29 — text and numbers (reviewer B)

## Releasing one of two registrations of the same shaper or bidi engine unregisters it for both
- where: packages/text/src/layout/engineSlot.ts:14-28 (engineSlot.register), behind registerShaper / registerBidi
- scenario: `loadShaper()` answers the same shaper to every caller, and `bidi` is a module constant, so two independent owners (two mounted components, a lab page and a canvas preset) each call `registerShaper(shaper)`. The second call does not throw (same engine) and gets its own release. When the first owner unmounts and calls its release, `registered === engine` holds and the slot is cleared, so the second owner, still mounted, loses shaping (or bidi) and the text engine generation bumps. The release should only clear the slot once every registration of that engine has released (count per engine), or the second register should hand back a no-op.
- evidence: read
- severity: medium

## The caret a click lands on is laid out at scale 1 while `{ px }`-sized text is painted at the view scale
- where: packages/text/src/hitTest.ts:72 (caretIndexAt, no scale parameter; calls layoutTextPose(pose) at its default scale 1); caller packages/text-tools/src/editor/textHitAt.ts:70 (textHitAt)
- scenario: a text node whose `style.fontSize` (or `letterSpacing`, or a run's) is `{ px: 12 }`, viewed at zoom 2. `TEXT_PAINTER` paints it laid out at `textLayoutScale(d, ctx.scale)` = 2 (6 world units per em), and `textLineBoxes` takes a `scale`, but `caretIndexAt` always lays the pose out with the `{ px }` length resolved at scale 1 (12 world units per em). A double-click (enterTextEdit → textAt → textHitAt) then maps the pointer onto glyphs twice as wide as the ones drawn, so the caret opens at the wrong character (and on the wrong line for wrapped text). `textPoseLayoutInput`'s own doc says every reader of one pose must pass the same scale or they disagree; caretIndexAt has no way to, and textHitAt has the view scale in hand only through the scene's canvas.
- evidence: read
- severity: medium

## Shrink-to-fit keeps a scale computed under the old shaper or bidi engine after one is registered
- where: packages/text/src/layout/textFit.ts:46-48 (sameOpts) and :114-118 (shrinkScale cache reset on faceGeneration only)
- scenario: a `fit: 'shrink'` text node is laid out before `registerShaper(await loadShaper())` (or `registerBidi`) resolves, the usual startup order since the shaper loads asynchronously. `shrinkScale` caches the scale keyed by runs, box and `sameOpts`, which compares neither `bidi` nor `shaper` (and the registered ones are not in `opts` at all), and the cache is dropped only when `faceGeneration()` moves; registering an engine bumps `textEngineGeneration`, not the face generation. The layout cache, whose `matches` does compare `bidi` and `shaper`, re-lays the text with the shaper (joined Arabic, ligatures: different widths), but at the scale fitted to the unshaped widths, so the text overflows its box or sits smaller than the box allows until some face lands. The fit key should include the effective engines (or reset on `textEngineGeneration`).
- evidence: read
- severity: low

## A text style's selection colors are pasted unescaped into a document-wide `<style>` rule
- where: packages/text-dom/src/overlayOpen.ts:43-58 (installSelectionStyle), fed by packages/text/src/textStyle.ts resolveTextStyleInto (`selectionBackground`, `selectionColor`, and the default `color-mix(...)` built from `caretColor`)
- scenario: `selectionBackground`, `selectionColor` and `caretColor` are free strings in a node's stored `TextStyle`, so they arrive from whatever document was opened or pasted. Opening an edit on a node whose style holds `selectionColor: "red } body { display: none"` (or a `caretColor` with a `}` in it, which reaches the rule through the default `color-mix`) appends `.weasel-text-edit-N::selection { color: red } body { display: none; }` to `document.head`, so the stored value restyles the whole host page for as long as the edit is open, and can load `url(...)` resources. The value should be set through the CSSOM (`sheet.insertRule` with a property set via `style.setProperty`) or validated with `CSS.supports('color', v)` before it is written.
- evidence: read
- severity: low

## A clipped text node's outlines include the lines its painter and silhouette cut off
- where: packages/text-tools/src/node/textOutline.ts:10-19 (textOutlineOf), against packages/text-tools/src/node/textPainter.ts:126-135 (silhouette) and :177-179 (paintText)
- scenario: a sticky note (`overflow: 'clip'`, the sticky default) whose text runs past its box. The painter wraps the text in `clippedToBox`, and the silhouette cuts its line boxes to the box ("as they are drawn"), but `textOutlineOf` never reads `d.overflow` and hands `textToPath` the whole layout. Converting the note to outlines (or anything reading `NodeShapeEntry.outline`, such as a boolean or an export) produces glyphs below the note that were never visible. One node kind answers "what does this node cover" two ways.
- evidence: read
- severity: low

<!-- done: 5 findings, files read: 106 -->
