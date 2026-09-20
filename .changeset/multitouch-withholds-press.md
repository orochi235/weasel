---
'@weasel-js/routing': patch
---

Withhold the eager `stage: 'press'` dispatch from a pointer that lands while
another is already down. `pointerDown`-spec bindings fired for a pinch's second
finger, so starting a two-finger gesture could run `select.pick` and change the
selection under it. The multi-pointer policy already cleared that pointer's
buffered drag press for the same reason; the eager copy was left unconditional.
