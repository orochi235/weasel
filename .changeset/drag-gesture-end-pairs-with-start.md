---
'@weasel-js/core': patch
---

`useDragGesture`, `useDragRect`, and `useDragRadial`: `onGestureEnd` now fires once per `onGestureStart`. `end()` or `cancel()` with no gesture live does nothing, where it used to fire `onGestureEnd(false)`, and a `start()` that replaces a live gesture no longer fires `onGestureStart` a second time. A caller that relied on `onGestureEnd(false)` from an idle `end()` or `cancel()` no longer gets it.
