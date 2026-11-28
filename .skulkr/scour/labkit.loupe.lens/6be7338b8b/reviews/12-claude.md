## LensZoom's release microtask runs before the slider's own pointerup listeners, not after
- where: packages/labkit/src/loupe/lens/LensZoom.tsx:56 (LensZoom watchPress `end`)
- scenario: a real (trusted) pointerup ends a zoom drag. `end` is a window capture listener, so it runs first; the browser performs a microtask checkpoint after each listener callback of a native dispatch, so the queued microtask (gesture += 1, `onRelease` → `lensActions.activate()` + `input.focus()`) runs before the Slider's pointerup handler fires `onChange`. When that final `onChange` carries a value different from the last `onInput` (the release step's snap), `write` uses the already-bumped `gesture.current`, so the commit lands in a new undo entry instead of the press's entry, and focus has already left the slider before it handles the release. The comment's ordering ("After the slider's own listeners for this event") only holds for synthetic `dispatchEvent` in tests, where microtasks wait for the whole dispatch.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/LensZoom.tsx
- size: function
- cause: microtask checkpoint between native listeners
- confidence: likely

## A Live lens's copy loses every id-keyed style of the trial
- where: packages/labkit/src/loupe/lens/cloneSource.ts:89 (stillCopy)
- scenario: a story styled by `#panel { background: … }`, or `[id=…]` selectors, or an SVG `<use href="#sym">` inside the copy. stillCopy removes `id` from the copy and every descendant, so those stylesheet rules no longer match inside the lens and it shows the story unstyled (wrong colors, layout); this is the opposite of what a magnifier should show. The removal is there to stop `getElementById`/`for`/`url(#…)` collisions, but it also drops the cascade.
- evidence: read
- severity: medium
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: design
- cause: id stripping also strips id-selector styling
- confidence: sure

## The clone source copies no shadow DOM, so web-component content is blank in a Live lens
- where: packages/labkit/src/loupe/lens/cloneSource.ts:203 (CloneCell.recopy)
- scenario: a trial rendering a custom element with an (open, non-clonable) shadow root. `root.cloneNode(true)` copies the host but not its shadow root, so the lens shows the host empty (or only its light-DOM children unslotted); canvases and control state inside the shadow tree are never mirrored either, since `querySelectorAll` does not enter shadow roots.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: function
- cause: cloneNode skips shadow roots
- confidence: likely

## scrollByWheel chains through light-DOM parents, skipping a slotted element's shadow-tree scrollers
- where: packages/labkit/src/loupe/lens/scrollByWheel.ts:43 (parentOf)
- scenario: content slotted into a web component whose shadow tree wraps the `<slot>` in an `overflow: auto` scroller. Under a lens, the wheel is handed to the slotted element; `parentOf` returns its `parentElement` (the host, in light DOM) and never visits the scroller around the slot, so the scroller does not scroll, although the browser's own scroll chaining follows the flat tree (`assignedSlot`) and would scroll it.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/scrollByWheel.ts
- size: line
- cause: light-tree parent instead of flat-tree parent
- confidence: likely

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

<!-- done: 4 findings, files read: 33 -->
