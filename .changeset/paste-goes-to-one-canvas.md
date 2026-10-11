---
'@weasel-js/routing': patch
---

With two canvases on a page, one Cmd+V pasted into both: each `useGestureDispatcher` hears `paste` on `window` and neither checked whether it was the one to act. A paste now goes to the active input scope only, the canvas that last took a pointerdown or wheel, as a keystroke does, and a paste something else already called `preventDefault` on is left alone.
