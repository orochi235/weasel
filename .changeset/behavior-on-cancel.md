---
'@weasel-js/core': patch
---

Action behaviors get an `onCancel` hook. When a move, resize, rotate, insert or lasso gesture is canceled (Esc, pointercancel), every behavior's `onCancel` runs in place of `onEnd`, which still runs only on commit. `alignMoveBehavior`, `alignInsertBehavior` and `alignResizeBehavior` clear their published guides there, so Esc mid-drag no longer leaves the last matched alignment line on screen, and `snapToContainer` drops its pending dwell timer.
