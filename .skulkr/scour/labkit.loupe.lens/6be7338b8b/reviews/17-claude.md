# Findings: labkit.loupe.lens

## A round lens clips its "unavailable" reason to a sliver of the circle's top chord
- where: packages/labkit/src/loupe/lens/Lens.less:173 (.lk-lens-reason), rendered inside the slot by packages/labkit/src/loupe/lens/LensSlot.tsx:258 and :221
- scenario: a lens of the default `circle` shape whose wanted source is unavailable ("Pixels unavailable: needs Playwright"), or a Difference lens with no Pixels source. `.lk-lens-reason` is a full-width strip at `top: 0` *inside* `.lk-lens-slot`, which a circle lens clips with `clip-path: ellipse(...)`. On a 160px body, about 10px down the chord is only about 76px wide, so most of the message is cut off and the first line is close to invisible. The readouts, which sit outside the slot, already get a circle rule (`top: 14%; max-width: 60%`). The reason gets none, so it should be readable inside the circle the same way.
- evidence: read
- severity: medium
- fix: packages/labkit/src/loupe/lens/Lens.less
- size: line
- cause: reason placed inside the clipped slot with no circle rule
- confidence: likely

## A lens copy keeps `name` attributes, so the copy answers the trial's named lookups
- where: packages/labkit/src/loupe/lens/cloneSource.ts:86 (stillCopy)
- scenario: the trial under a lens holds `<form name="login">`, `<iframe name="preview">`, `<img name=…>` or `<embed name=…>`. `stillCopy` strips `id`, a radio's `name`, `form`, and frame `src`. It leaves `name` on those elements, so once the copy is connected, `document.forms.login`, `document.login` and `window.preview` return a collection or the copy's element. A `target="preview"` link or `window.open(url, 'preview')` can also resolve to the copy's (src-less) iframe browsing context instead of the trial's. Removing ids for this exact reason ("an id would answer the trial's own `getElementById`") while keeping `name` gives two different answers to one question.
- evidence: read
- severity: low
- size: line
- cause: incomplete attribute stripping in stillCopy
- confidence: likely

## Custom elements in a copy are upgraded and connected, rerunning their live behavior on every recopy
- where: packages/labkit/src/loupe/lens/cloneSource.ts:191 (CloneCell.recopy)
- scenario: a story that renders a defined custom element (a web-component widget that starts timers, fetches, or registers global listeners in `connectedCallback`). `root.cloneNode(true)` creates upgraded instances, and `replaceChildren` connects them. Every mutation under the root then recopies it, which can happen on every frame, and each recopy constructs and connects fresh instances and disconnects the old ones. `stillCopy` takes the live behavior out of frames, media and forms, but does nothing about custom elements. The copy duplicates the story's side effects and can churn them at frame rate.
- evidence: read
- severity: low
- size: function
- cause: clone of upgraded custom elements is live
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

<!-- done: 3 findings, files read: 33 -->
