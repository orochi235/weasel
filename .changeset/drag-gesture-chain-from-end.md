---
'@weasel-js/core': patch
---

A drag gesture that `onEnd` or `onCancel` starts stays live, and a `cancel()` from inside `onEnd` no longer fires `onGestureEnd` twice.

`useDragGesture`, `useDragRect`, and `useDragRadial` close a gesture before its `onEnd` or `onCancel` runs, so `cancel()` from inside either is a no-op and `start()` opens a new gesture with its own `onGestureStart`.

<!-- entry: fix -->
