- canvas editor stands down for a host editor of another scene, then falls to the stub (A): fixed 696536b026 (docs f0e8b06fcf)
- canvas editor stands down for a host of another scene (B): duplicate of A "canvas editor stands down…", fixed in 696536b026
- editEffectText caret comes from the default `data.text` and stored data, not the editor's `getText` or the draft (A): fixed e11dcfe245, on a new `caret: 'end'` option 7b849c9575 (text-dom and text-tools, minor changeset)
- enterTextEdit swallows the sticky tool's click on a selected non-text node or a multi-selection (A): fixed d345d2773b
- sticky `background` or `fill` with no `paint` still gets the default paper and ink (A): fixed ed14acc264
- `useStickyTool({ background: {} })` still makes yellow notes (B): duplicate of A "sticky background/fill with no paint", fixed in ed14acc264
- properties panel "Text" writes `data.text` alone, so a node with runs never shows the edit (B): fixed 41e7aaa23c. `TEXT_PROPERTIES.settle` splices the changed span into the runs, and new text takes the style of the run to its left, as the 2026-11-11 ruling in `docs/unruled.md` says. It needed `replaceRunRange` and `runStyleAt` exported from text-dom: 875dcd17cf, minor changeset.
- rotated clipped text outline keeps glyphs that sit in its box's axis-aligned bounds (B): fixed 155cca4f58
- `drawnBounds` and `ink` ignore run strokes (B): fixed 166ef0c66b
- `fit: 'shrink'` paint memo keeps the fit from before the face loaded (B): fixed f36424ffb5. This changes a paint cache key (one counter sum read per paint). I did not benchmark it before and after on the fleet, which the repo's rule for cache changes asks for; the controller should queue that bench.
- double-click on glyphs drawn past the box doesn't open them, though a click selects (B): not a defect. A click is also gated on the pose box (`scenePointQuery.ts:38-40` checks `poseContainsRotated` before the silhouette), so a click on overflow glyphs selects nothing either. Click and double-click agree.
- canvas editor's stand-in hides the edited glyphs on every canvas of the scene sharing its offset parent (B): fixed ed5095de74

Extra: none. 1aea044cb2, be3caa6117 and 55b7328fdf only fix things my own commits broke: changeset titles over the length limit, a doc block that got displaced, and the `hostTextEditorHolds` query that `apps/site/demos/__tests__/TextDemo.test.tsx` imports, now documented as a test-only query.

Checks:
- touched test files, each run alone with `--maxWorkers=1`, all pass:
  - `canvasEditor.test.tsx`, `enterTextEdit.test.ts`, `editEffectText.test.ts`
  - `text-dom/src/overlayOpen.test.ts`, `runSplice.test.ts`
  - `useStickyTool.test.ts`, `stickyNode.test.ts`, `stickyStyle.test.tsx`, `stickyPreset.test.tsx`
  - `properties.test.ts`, `textOutline.clip.test.ts`, `textOutline.createOutlines.test.ts`, `textOutline.createOutlinesAction.test.ts`
  - every `textPainter.*.test.ts` (box, cache, drawOne, drawn, ink, overflow, poseTransform, runs, screen, silhouette)
  - `textEditStub.test.tsx`, `apps/site/demos/__tests__/TextDemo.test.tsx`
- no browser tests touched.
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/text-tools` and `-w @weasel-js/text-dom`: neither package has a `lint` script ("Missing script: lint"). As a substitute, eslint on every changed `.ts`/`.tsx` file: pass, no output.
- `npm run check:size`: pass. `npm run check:changesets`: pass.
- tree clean.

tally: 11 of 12 fixed, 0 extra fixed