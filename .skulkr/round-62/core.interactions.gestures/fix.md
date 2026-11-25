[r42-1] nested drop zones resolve by registration order (carried): fixed 0bb22a88ea
[r42-2] `useDragRect`/`useDragRadial` `isActive` disagrees with the base controller (carried): fixed aea6b6e4f2
[r42-3] a throwing `accepts` strands every later drag (carried): fixed 51abc40ff8
[r42-4] `useDragHandle` calls the press-time `getPayload` at threshold (carried): fixed c4f5c70e13
[r42-5] default ghost sized in client px but drawn in the seat's scaled px (carried): fixed a47581494d
[r42-6] a press on an SVG icon inside a button starts a drag (carried): fixed 7c2a2a29ee
[r42-7] an `onActivate` that cancels hands `onMove` a ctx whose fields throw (carried): fixed b6c74b1d78 (also covers an `onActivate` that restarts the gesture)
[r42-8] `screenTolerance` ignores the gesture's parallax plane (carried): fixed 6668561b89
[r42-9] `useDragGesture` never calls `onGestureEnd` when its owner unmounts mid-gesture (carried): fixed 0676547370 (an unmount now cancels the gesture, so `onCancel` and `onGestureEnd(false)` both fire)
[r42-10] default drag ghost copies its source's id attributes into the document (carried): fixed 6d84a7daf6

No extra defects found.

Checks:
- Every touched test file, one at a time with `--maxWorkers=1`: pass. That covers `pointerDrag.zones`, `pointerDrag.seat`, `pointerDrag`, `pointerDrag.clickGuard`, `dragGesture.abort`, `dragGesture`, `dragRect/isActive`, `dragRect`, `dragRadial`, `shared/screenTolerance` and `editing/.../viewInput.test.tsx` (which calls `screenTolerance`). No browser test files were touched.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed on a type error in the new `isActive` test and on three changeset titles over 140 characters. Both were fixed into their own commits before the rerun.
- `npm run check:changesets`: pass ("OK — 3219 changeset(s)").
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script ("Missing script: \"lint\""). I ran `npx eslint packages/core/src/interactions/gestures` instead: pass (exit 0).
- Tree clean; every change is committed.

tally: 10 of 10 fixed, 0 extra fixed