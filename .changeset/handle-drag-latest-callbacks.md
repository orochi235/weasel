---
'@weasel-js/core': patch
---

`useHandleDrag` ran the `onMove`, `onEnd`, and `onCancel` from the render that saw the press for the whole drag, so an `onEnd` that closed over state set by `onMove` committed the value from before the drag. Each callback is now the one from the latest render.
