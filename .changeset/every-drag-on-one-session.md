---
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Run the last four drags in the kit on `openPointerSession`. Capture, pointer identity, teardown and recovery from a release that never arrives are now decided in one place for every pointerdown-to-pointerup lifecycle in the kit.

Fix a drag that silently dropped its commit. `openPointerSession` treated `lostpointercapture` as the end of the gesture, and Chrome releases capture implicitly a beat *before* it delivers `pointerup` — so a release already on its way arrived after the session had torn down its listeners, and the gesture ended as a cancel instead of a commit. Roughly three drags in four were lost this way in one measured consumer. Losing capture now ends a session only once the origin has left the document, which is the case the rule was written for: the session listens on the document, so capture is what retargets events, not what delivers them.

The gesture dispatcher opens a session per held pointer instead of tracking pointers itself. Two behavior changes come with that: a drag released outside the canvas now ends, where before only pointer capture made that work; and a fresh press on a pointer still believed held cancels the stale gesture rather than committing it at the new press's coordinates, since where it actually ended is unknown.

Two small breaking changes. `ThresholdDragOptions.onCancel` now fires only when a gesture ends without a release — a release below the threshold calls the new `onClick`. And in labkit, `useDragDrop`'s `startDrag` and `Palette`'s `onDragStart` take the React pointerdown event in place of a `Point`; a cancelled palette drag now drops nothing, where before it had no cancel path at all.

`startThresholdDrag` also takes an `origin` element, for a list whose grabbed row unmounts mid-drag and drops capture with it. `useReorderDragList` uses it and no longer carries its own copy of the threshold logic.
