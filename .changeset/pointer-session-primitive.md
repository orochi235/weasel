---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Add `openPointerSession`, and put the kit's drag lifecycles on it.

`useHandleDrag`, `startThresholdDrag` and `useDragHandle` each owned a pointerdown-to-pointerup lifecycle and each answered the same four questions differently. Capture: two took it untry'd, one never took it. Listeners: one on the element, two on `document`. Pointer identity: none of the three filtered by `pointerId`, so a second finger drove and could end a drag in progress. Teardown on unmount: one had none, one had it for half its lifecycle.

None of them — nor the dispatcher — handled `lostpointercapture`, and none read a `pointermove` with no button held as the release it missed. So a drag whose pointer left the element, or whose capturing element was removed mid-gesture, hung in flight with no end and no cancel.

`openPointerSession(origin, downEvent, callbacks)` now decides all of it once: capture on the origin, listeners on the document so a removed element cannot strand the gesture, every event filtered to its own pointer, `lostpointercapture` and the missed release both closing the session, and one `cancel()` for unmount, Escape or blur. The missed-release rule disarms itself when the press reports no button state, so synthesized events do not read as instant releases.

`useGestureDispatcher` keeps its own multi-pointer lifecycle — one canvas listener set keyed by `pointerId` is the right shape for multitouch — but takes both recovery rules from the same module, so there is one implementation of each rather than two that drift.

Breaking, in `useHandleDrag`: `onEnd` now fires only on a real release and receives `{ point, moved, event }` instead of a bare event; a cancelled gesture reports through the new `onCancel(reason)`. The old signature made every commit-on-end consumer sniff `e.type === 'pointercancel'` to tell an edit from an abandoned drag, and hold its own ref to recover the end position — `GradientEditor` does neither now.
