I couldn't write `.skulk/out/findings.md`: the first finding went in, but every later write to the file was refused. Here is the whole document instead:

# Audit round 42: core.domains

## resolveVisibility looks a chrome id up through Object.prototype
- where: packages/core/src/domains/chrome-caps/resolve.ts:19 (resolveVisibility)
- scenario: `ChromeId` is open (`string & {}`) and `merged` is a plain object literal. Take a consumer chrome id named `'constructor'`, `'toString'`, `'valueOf'` or `'hasOwnProperty'` that has no rule of its own. The lookup reads `Object.prototype[id]`, which is a function, so the `typeof entry === 'function'` branch calls it with the rule ctx:
  - `Object(ruleCtx)` returns the ctx, which is truthy.
  - `toString` returns `"[object Object]"`, so the gate answers a non-boolean.
  - `hasOwnProperty(ruleCtx)` returns false, which hides a chrome element that should fall through to `always`.

  The lookup should check `Object.hasOwn(merged, id)`, or build the merge on a null-prototype object.
- evidence: read
- severity: low

## A consumer rule set to `undefined` replaces the kit default with "always visible"
- where: packages/core/src/domains/chrome-caps/resolve.ts:14-20 (resolveVisibility)
- scenario: `VisibilityRules` is `Partial<Record<ChromeId, …>>`, so `{ 'snap.guides': hideGuides ? never : undefined }` typechecks. The spread copies that own `undefined` over the default `{ gesturing: true }`, and `entry === undefined` then answers `true`. So with `hideGuides` false the guides show all the time, not just while gesturing. `selection.resize-handles` set the same way shows even when nothing is selected. The docs say "absent keys fall through to defaults"; the merge should skip `undefined` values.
- evidence: read
- severity: low

## createCanvasCamera keeps a glide target after the glide ends, and reports it during someone else's glide
- where: packages/core/src/domains/presentation/presentationStep.ts:110-121 (createCanvasCamera)
- scenario:
  1. A host steps to page 3 through `stepPresentation(createCanvasCamera(api), …)`. `heading` is set to page 3's view and is never cleared when that glide ends.
  2. Later the view glides elsewhere by another route, such as `api.animateView` from a zoom-to-fit.
  3. "Next" is pressed during that second glide. Because `isViewAnimating()` is true, `target()` returns the stale page-3 view, `pageShown` picks page 3, and the step goes to page 4 instead of the page after the one the view is heading to.

  `viewCamera` answers the same question from the view dep's own `animationTarget`, so the two cameras disagree.
- evidence: read
- severity: low

## present.go cannot reach a page whose id is `'first'` or `'last'`
- where: packages/core/src/domains/presentation/presentationStep.ts:46-49 (requestedPage)
- scenario: `present.go` takes `{ to }` as a page id or index, and page ids are consumer strings. `requestedPage` checks the `'first'`/`'last'` keywords before it looks up ids. So `{ to: 'first' }` on a deck whose third page has id `'first'` shows page 0, and that page can't be reached by its id at all. The id lookup should come first, or the end keywords should be limited to `present.step`, where they are its variants.
- evidence: read
- severity: low

## Files read
packages/core/src/domains/chrome-caps/conditions.ts
packages/core/src/domains/chrome-caps/defaults.ts
packages/core/src/domains/chrome-caps/index.ts
packages/core/src/domains/chrome-caps/resolve.ts
packages/core/src/domains/chrome-caps/types.ts
packages/core/src/domains/chrome-caps/useChromeCaps.ts
packages/core/src/domains/chrome-caps/useHoverTracking.ts
packages/core/src/domains/ingestion/contentHandlers.ts
packages/core/src/domains/ingestion/index.ts
packages/core/src/domains/ingestion/openFilePicker.ts
packages/core/src/domains/ingestion/placement.ts
packages/core/src/domains/ingestion/useCanvasIngestion.ts
packages/core/src/domains/longPress/longPressFeedback.ts
packages/core/src/domains/modes/modeLayers.ts
packages/core/src/domains/modes/modeTriggers.ts
packages/core/src/domains/pathEffects/effectSources.ts
packages/core/src/domains/pathEffects/hiddenSources.ts
packages/core/src/domains/pathEffects/index.ts
packages/core/src/domains/pathEffects/readSource.ts
packages/core/src/domains/pathEffects/useEffectSourcesLayer.ts
packages/core/src/domains/poseRun/index.ts
packages/core/src/domains/poseRun/usePoseRun.ts
packages/core/src/domains/presentation/index.ts
packages/core/src/domains/presentation/presentationContribution.ts
packages/core/src/domains/presentation/presentationStep.ts
packages/core/src/domains/selection/enteredGroupFrame.ts
packages/core/src/domains/selection/enteredGroupScope.ts
packages/core/src/domains/selection/enteredOperands.ts
packages/core/src/domains/viewports/aim.ts
packages/core/src/domains/viewports/index.ts
packages/core/src/domains/viewports/viewMarker.ts
packages/core/src/domains/viewports/viewMarkerDrag.ts
packages/core/src/domains/viewports/viewResolver.ts
packages/core/src/domains/viewports/viewportLayer.ts

<!-- done: 4 findings, files read: 34 -->