---
'@weasel-js/routing': patch
---

On a canvas with a `<CanvasView>` panel, holding a key with the pointer over the panel and releasing it with the pointer anywhere else left the key's action running: Space-for-hand stayed engaged until Space was pressed again over the panel. `useGestureDispatcher` now sends a held key's release, and the release a window blur stands in for, to the view that took the keydown.
