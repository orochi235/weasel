browserReservedChord misses the tab-switcher chords, and on Apple any chord holding Ctrl (A): fixed 0cb52aa93e

handleDrag and thresholdDrag stay open across a window blur and commit on return (A): fixed c008e6b1d4. The session itself now cancels on blur, reporting `'blur'`, with `blur: false` to opt out. Carry's own blur listener is gone. This is recorded in `docs/unruled.md` as a fixer's call.

thresholdDrag reports a release it never saw, below the threshold, as a click (A): fixed 5d0d4ca9be

A carry whose release went unseen drops at the next move's point (B): fixed 5d0d4ca9be. The new session option `missedRelease: 'end' | 'cancel' | () => …` reports a cancel as `'missedrelease'`. Carry cancels. thresholdDrag cancels below its threshold and still ends past it. `useHandleDrag` and the dispatcher are unchanged. This is recorded in `docs/unruled.md` as a fixer's call.

undoKeyStep treats a text field inside a shadow root as a non-editable target (B): fixed c1b0e8193b. The fix is in `isEditableTarget`, which now looks through an open shadow root's focused element, so the dispatcher's keyboard and ingest channels are covered too.

useHandleDrag measures its box once, so a scroll during the drag shifts every point (B): fixed ce4f4deb71

The reserved-chord table can't express Ctrl+Tab (B): duplicate of A's browserReservedChord finding, fixed 0cb52aa93e

startThresholdDrag takes and releases its late capture itself, beside `session.capture()` (B): fixed 219b62957b. No behavior changes, so there is no failing test or changeset; the existing captureAt-threshold tests cover it.

Extra:
`useDragHandle` (core's pointerDrag) dropped its payload on a release it never saw (sweep): fixed 5d0d4ca9be. It now cancels, and its click guard treats a `'blur'` cancel like `'aborted'`, since the button is still down.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`, all pass:
  - browserReservedKeys 13/13
  - pointerSession 20/20
  - pointerSession.pbt 1/1
  - thresholdDrag 25/25
  - handleDrag 16/16
  - carry 2/2
  - carry.pbt 1/1
  - keyHelpers 10/10
  - pointerDrag 19/19
  - useGestureDispatcher.carry 10/10
- Unchanged but run, all pass: pointerDrag.clickGuard 6/6, pointerDrag.zones 10/10, useGestureDispatcher.pointerRecovery 10/10, keyOwner 35/35, the core/path-tools/ui/draw reserved-binding tests, and the blur tests in ui, draw, editing, text-tools, keymaps and core.
- Unrun: no `*.browser.test.*` file was run here; `carry.browser.test.tsx` and `pointerSession.browser.test.tsx` cover the carry and pointerSession code changed here.
- Every new test was seen failing before its fix.
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run check:changesets`: "[changesets] OK"
- `npm run lint -w` for routing, core and gestures: none of these packages has a `lint` script ("Missing script: \"lint\""). Root eslint on every changed file is clean, and the gate's `npm run lint` passed.
- Tree is clean.

tally: 8 of 8 fixed, 1 extra fixed