---
'@weasel-js/ui': patch
---

Fixes: a `Callout` following an `anchorRect` dispatched a `resize` event on `window` each time the rect changed, so every resize listener on the page ran once per pan frame. It now changes its hidden anchor's width by a sixteenth of a pixel on each move, which React Aria's own `ResizeObserver` on the anchor sees and nothing else does. Checked in headless Chromium only.
