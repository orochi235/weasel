# Audit round 83 — labkit.loupe.lens (blind reviewer)

## Reticle client points go stale when the lab body moves without a window scroll or resize
- where: packages/labkit/src/loupe/lens/useLensRemeasure.ts:31 (useLensRemeasure), with packages/labkit/src/loupe/lens/LensOverlay.tsx:184 (reticleClient)
- scenario: a lens is up, and the lab body moves or resizes inside the page without a window `resize` or any `scroll`: a sidebar collapses, a splitter is dragged, a panel above it grows. Nothing re-renders `LabLoupe`/`LensOverlay`, so `reticleClient` (computed only in render, from the layer's client rect) keeps the old client point. `CloneCell.position` (which a root's ResizeObserver does call) then subtracts the root's new `left/top` from the stale reticle, so the copy is shifted by the distance the body moved, and `rootAt` probes the stale point, possibly finding a different root or none. It should rerender on the body's own movement (e.g. a ResizeObserver on the body), as the hook's doc promises for "a resize".
- evidence: read (the layout cases are inferred, not run)
- severity: medium

## A Live lens's copy puts duplicate ids and duplicate trial markup into the document
- where: packages/labkit/src/loupe/lens/cloneSource.ts:207 (CloneCell.recopy) and :88 (stillCopy)
- scenario: a trial containing `<label for="x"><input id="x">`, an SVG `<linearGradient id="g">` used by `fill="url(#g)"`, or `aria-labelledby` references is copied by `root.cloneNode(true)`. `stillCopy` strips radio names, `form`, iframe sources and autoplay, but leaves every `id`. Once the copy is connected, `document.getElementById`, `label[for]`, `url(#…)` and IDREF attributes resolve to the first element in tree order, which is the copy when the lens layer precedes the trial; and any trial code doing `document.querySelectorAll('.foo')` now also counts the copy's elements, whatever the order. The copy should have its ids removed or rewritten (and same-copy references rewritten with them).
- evidence: read (which comes first in tree order depends on where the surface container sits; I did not trace it)
- severity: medium

## stillCopy misses other live elements a clone brings back to life
- where: packages/labkit/src/loupe/lens/cloneSource.ts:88 (stillCopy)
- scenario: the copy is connected to the document, so a cloned custom element is upgraded and runs its constructor and `connectedCallback` again (timers, fetches, global listeners, open shadow roots that `cloneNode` did not copy, which leave it rendering empty or differently); an `<object data>` / `<embed src>` loads its resource a second time, which is exactly what the function strips from `iframe`; `<frame>` is likewise not handled. The doc says the function "takes the live behavior out of a copy", and these keep theirs.
- evidence: read
- severity: low

## LabLoupe's compare-menu action is enabled and bound to `k` but does nothing
- where: packages/labkit/src/loupe/lens/LabLoupe.tsx:30 (LabLoupe) with packages/labkit/src/loupe/lens/lensActionDefs.ts:228 (settingActions, `compareMenu`)
- scenario: `LabLoupe` builds its api without a `compare` ref, so `openCompareMenu` is `refs.compare?.current?.(lensId)`, a no-op. `loupe.compare.menu` is made with `on(...)` and the default `enabled`, so with any lens up it lists as enabled in the Loupe keymap and its hint, and Alt+L then `k` silently does nothing. `loupe.compare.opposite` in the same host is correctly disabled (its patch changes nothing). The menu action should be disabled with a reason when the host has no compare menu.
- evidence: read
- severity: low

## The wheel pass-through and the clone source's root probe hit-test the global document, not the layer's
- where: packages/labkit/src/loupe/lens/useWheelPassThrough.ts:14 (onWheel); packages/labkit/src/loupe/lens/cloneSource.ts:28 (rootAt)
- scenario: a lab rendered into another document (a popout window, or a lab inside an iframe driven from the parent's React tree) gets `document.elementFromPoint` / `document.elementsFromPoint` of the module's realm, which knows nothing of the layer; the wheel is never passed on and no lens finds a root. The neighbors in the same pipeline (`intoFrames`, `scrollByWheel`, `difference.ts`) all take `ownerDocument` instead, so the question "which document" is answered two ways along one path. Use `layer.ownerDocument` / `slot.ownerDocument` (and their `createElement` in `CloneCell`).
- evidence: read
- severity: low

## Files read
packages/labkit/src/loupe/lens/GridCanvas.tsx
packages/labkit/src/loupe/lens/LabLoupe.tsx
packages/labkit/src/loupe/lens/Lens.less
packages/labkit/src/loupe/lens/LensActions.tsx
packages/labkit/src/loupe/lens/LensChrome.tsx
packages/labkit/src/loupe/lens/LensOverlay.tsx
packages/labkit/src/loupe/lens/LensSlot.tsx
packages/labkit/src/loupe/lens/LensZoom.tsx
packages/labkit/src/loupe/lens/ScopeOf.tsx
packages/labkit/src/loupe/lens/cloneSource.ts
packages/labkit/src/loupe/lens/compare.ts
packages/labkit/src/loupe/lens/difference.ts
packages/labkit/src/loupe/lens/intoFrames.ts
packages/labkit/src/loupe/lens/lensActionDefs.ts
packages/labkit/src/loupe/lens/lensApi.fixture.ts
packages/labkit/src/loupe/lens/lensApi.ts
packages/labkit/src/loupe/lens/lensHitBoxes.ts
packages/labkit/src/loupe/lens/lensScene.ts
packages/labkit/src/loupe/lens/lensShapes.ts
packages/labkit/src/loupe/lens/lensSource.ts
packages/labkit/src/loupe/lens/lensTypes.ts
packages/labkit/src/loupe/lens/lensZoomTrack.ts
packages/labkit/src/loupe/lens/pixelGrid.ts
packages/labkit/src/loupe/lens/probeUnderLens.ts
packages/labkit/src/loupe/lens/reticleFollower.ts
packages/labkit/src/loupe/lens/scrollByWheel.ts
packages/labkit/src/loupe/lens/useCaptureDelay.ts
packages/labkit/src/loupe/lens/useFocusReports.ts
packages/labkit/src/loupe/lens/useFrameSchedule.ts
packages/labkit/src/loupe/lens/useLabBody.ts
packages/labkit/src/loupe/lens/useLensRemeasure.ts
packages/labkit/src/loupe/lens/useLensShapes.ts
packages/labkit/src/loupe/lens/useWheelPassThrough.ts

<!-- done: 5 findings, files read: 33 -->
