- Ghost clones a checked radio, which unchecks the original (A+B): fixed 06f591c1ac
- `onEnd` that calls `cancel()` fires `onGestureEnd` twice (A+B): fixed eb4b752149
- `onEnd` that calls `start()` has its new gesture wiped (A+B): fixed eb4b752149. `onCancel` had the same bug and `useDragRect`/`useDragRadial` cleared the chained gesture's overlay; both fixed in the same commit.
- A `start()` that replaces a live gesture drops it with no `onCancel` (B): fixed eb4b752149, doc only. Skipping `onCancel` and `onEnd` on a restart is deliberate and tested (`dragGesture.test.ts`, "replaces state as one gesture"), so I documented it on `onGestureStart` and left the behavior alone.
- `edgeHandlesFit` passes every body when the frame is singular (A): fixed 5b2d8aa917
- `EDGE_HANDLE_MIN_RADII` doc contradicts the check (A+B): fixed 5b2d8aa917, doc rewritten to match the code (a side must span 6 radii)
- `useDragRect`'s end `isSubThreshold` is stale after `onEnd` moves a corner (A+B): fixed 3e3cdc2f53. 5b5f40168e then split the function to stay under `check:size`.
- `findZone` hit-tests the global `document` instead of the source's (A): fixed 8766c4f59c. The ghost's `getComputedStyle` and badge `createElement` now use the source's document too.
- [r42-1] nested drop zones resolve by registration order (carried): not a defect (no longer applies; `findZone` picks the innermost)
- [r42-2] `isActive` in the rect/radial wrappers disagrees with the base controller (carried): not a defect (no longer applies; both forward `gesture.isActive`)
- [r42-3] an `accepts` that throws strands the drag (carried): not a defect (no longer applies; `zoneCall` catches it)
- [r42-4] `getPayload` is read from press time (carried): not a defect (no longer applies; `getPayloadRef.current()` is read at threshold)
- [r42-5] ghost sized in client px but drawn in its seat's scaled px (carried): not a defect (no longer applies; the size is divided by `seat.scale`)
- [r42-6] a press on an SVG icon inside a button starts a drag (carried): not a defect (no longer applies; `closest` on any Element)
- [r42-7] `onActivate` that cancels hands `onMove` a ctx whose fields throw (carried): not a defect (no longer applies; `stateRef.current !== s` guard)
- [r42-8] `screenTolerance` ignores the parallax plane (carried): not a defect (no longer applies; it multiplies by `plane.scale`)
- [r42-9] unmount mid-gesture never closes `onGestureStart` (carried): not a defect (no longer applies; `useEffect(() => cancel)`)
- [r42-10] ghost clones id attributes (carried): not a defect (no longer applies; ids are stripped)

Extra:
- `useDragHandle`'s check for a press on a control used `instanceof Element`. That is false for an element from another window's document, so a press on a button in a pop-out or iframe row started a drag (sweep): fixed 37320dd331

Checks:
- Each touched test file, `--maxWorkers=1`: `dragGesture.abort.test.ts` 7 passed, `dragGesture.test.ts` 24 passed, `dragRect.test.ts` 16 passed, `dragRadial.test.ts` 5 passed, `resizeHandles.test.ts` (new) 2 passed, `pointerDrag.zones.test.ts` 10 passed, `pointerDrag.test.ts` 18 passed. Each new test failed against the old source first.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed `check:size`, with `useDragRect` at 122 lines; 5b5f40168e fixed it.
- `npm run check:changesets`: pass.
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script. The root `npm run lint` passed inside the gate.
- Tree clean; `.skulkr/` untouched.

tally: 12 of 22 fixed, 1 extra fixed