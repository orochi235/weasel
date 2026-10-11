---
'@weasel-js/core': patch
---

A `stagger` whose factory returned an animation that had already finished (an empty inner `stagger`, a `loop` with `count: 0`) never completed: `isActive()` stayed true and the animator kept requesting frames. Such a child now counts as done at once.
