## A Live lens's copy of an open named `<details>` always shows it closed
- where: packages/labkit/src/loupe/lens/cloneSource.ts:91 (stillCopy)
- scenario: a story renders an exclusive accordion, `<details name="faq" open>…</details>` among siblings sharing `name="faq"`. `recopy` clones the root and connects the clone into the lens box. `stillCopy` strips `name` from radios but not from `<details>`, so the connected clone joins the trial's `faq` details name group. HTML's insertion steps for an open `<details>` in a group that already has an open member close the *inserted* element, so the copy's section renders closed while the trial shows it open. Every recopy (any mutation under the root) inserts a fresh clone, so it never shows correctly. `mirrorState` does not carry `open` either. The copy should show the section open, as the trial does.
- evidence: read
- severity: medium
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: line
- cause: details name group not neutralized in the copy
- confidence: likely

## A Live lens's copy omits an open popover in the trial
- where: packages/labkit/src/loupe/lens/cloneSource.ts:56 (mirrorState)
- scenario: a story shows a menu or tooltip through the Popover API (`popover` attribute, opened with `showPopover()`), and the reticle sits over it. `elementsFromPoint` reaches the popover, and `closest('.lk-trial__body')` finds the trial body, which `recopy` clones. Open state lives in the top layer, not in the markup, so the cloned element keeps `popover` and is hidden by the UA's `[popover]:not(:popover-open)` rule. `mirrorState` carries scroll offsets and control state but not popover state, so the lens shows what lies under the popover rather than the popover the user is aiming at. The same goes for a `<dialog>` opened with `showModal()`, which the copy draws in flow as non-modal.
- evidence: read
- severity: low
- size: function
- cause: top-layer state not mirrored to the copy
- confidence: likely

## A copy's named elements still answer the trial's `getElementsByName` and `document[name]` lookups
- where: packages/labkit/src/loupe/lens/cloneSource.ts:91 (stillCopy)
- scenario: a story reads `document.getElementsByName('agree')` for a checkbox group, or reaches `document.settings` for a `<form name="settings">`. While a Live lens's copy of that story is connected, the copy's elements keep their `name` (only radios lose theirs), so `getElementsByName` returns twice as many elements, the copy's among them. `document.settings` turns from the form into an HTMLCollection of two forms. A copy that has been taken out of the trial's id lookups should be out of its name lookups too. `stillCopy`'s doc lists the id cases but drops `name` on everything except radios.
- evidence: read
- severity: low
- size: line
- cause: `name` kept on copied controls and forms
- confidence: likely

## intoFrames maps the y coordinate into a frame with the x scale
- where: packages/labkit/src/loupe/lens/intoFrames.ts:25 (intoFrames)
- scenario: an isolated story's iframe is drawn under a non-uniform transform, for example a pane scaled `scale(2, 1)`. The code measures `scale = box.width / frame.offsetWidth` and divides both `at.x - left` and `at.y - top` by it, so a wheel handed through `useWheelPassThrough` lands at the wrong row inside the frame (y off by a factor of 2), and the frame's `elementFromPoint` may return the wrong element or null. Elsewhere in this area the scale is per axis (`layoutBoxOf(...).scale.x/.y` in cloneSource and lensApi). The y scale should come from `box.height / frame.offsetHeight`.
- evidence: read
- severity: low
- size: line
- cause: one scale used for both axes
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
