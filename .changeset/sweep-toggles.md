---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Add `sweepAction`: an action bound to a drag that sets each item of a surface the pointer crosses, and a `sweep` prop on `ToggleBar` (multiple mode) and `OptionsBar`, which sets every segment a drag reaches to what the press set the pressed one to. `sweep` takes `true` or a function that decides per press (`SegmentSweep`).

`useGestureDispatcher` takes `controls: 'take'`, for a surface whose buttons are its items: presses on them are dispatched, and the pointer is captured only once a press becomes a drag, so a click still reaches the button. A dispatcher now gives up a press that an element inside it opened its own pointer session for, so an item's drag beats its surface's gesture. A `PointerSession` gains `capture()`.
