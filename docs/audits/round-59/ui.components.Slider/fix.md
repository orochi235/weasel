`onAddThumb` on an endless slider gets the track position instead of the value (A+B): fixed 6001772010

A thumb added under `constraint: 'ordered'` is put last, out of order (A+B): fixed 50b4cbc0c6

A region drag and a thumb drag can run at once, each writing its own snapshot (A+B): fixed f39f2d7e45

`useBoxes` never measures an element that replaces another while the thumb count stays the same (A+B): fixed f276f9954b

`endless="min"` under a log `scale` throws during render (B): fixed 0f684e24a7. Under a `scale`, the end stop now sits a twentieth of the track past the end. This also moves the `endless="max"` stop on a log track, which used to sit one step past max, too close to see or press.

Shift-all and region drags ignore `snap: 'strict'` and the step grid (B): fixed 48a98dce93. This needed a behavior call, so I made one and recorded it in `docs/unruled.md`, replacing the Open entry. Under strict, each thumb moves the same number of stops, as many as the pointer crossed, so the thumbs stay on stops but may not keep their gap. Otherwise each thumb lands on the `step` grid.

A key that cannot move a thumb still commits an edit (B): fixed 9a7516700f. `docs/conventions.md` already rules this, so I retired the Open entry in `docs/unruled.md`. The key is still kept from the page. One stops test that expected the old no-op `onInput` now expects none.

On an endless slider whose range is not a whole number of steps, a drag cannot reach the finite end (B): fixed 7d851b4e8e

A thumb's `aria-valuemin`/`aria-valuemax` ignore its own `bounds` and its ordered neighbors (B): fixed 7bd3f466ec

Escape after a thumb drag that came back to its start sends no `onCancel`, while a region drag does (B): fixed 48263cb553

An end stop's label is pulled off center when that stop is not at the track's end (B): fixed 337c48e0c7

No extra defects found.

Checks:
- Every test file I touched, one at a time, `--maxWorkers=1`: pass. These were `Slider.endless`, `Slider.addRemove`, `Slider.regions`, `useBoxes`, `Slider.keyboard`, `Slider.stops`, `Slider.constraints` and `Slider.drag`.
- `npx vitest run --maxWorkers=1` over `packages/ui/src/components/{Slider,Along,Properties}`: 131 files, 840 tests, pass. No browser test file was touched.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/ui`: cannot run, because the package has no `lint` script ("Missing script: \"lint\""). eslint on every changed file passes, and the gate's root `npm run lint` passes.
- `npm run check:size`: pass. `npm run check:changesets`: pass.
- The tree is clean.

tally: 15 of 15 fixed, 0 extra fixed