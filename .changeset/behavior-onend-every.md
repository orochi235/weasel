---
'@weasel-js/core': patch
---

On a committed move, resize, rotate, insert or lasso gesture, every behavior's `onEnd` now runs, in order; the first one to answer still decides the commit and later answers are ignored. Previously the behaviors after the one that answered never ran, so `[snapBackOrDelete(…), alignMoveBehavior(…)]` left its alignment guides on screen after a snap-back release.

`onEnd` takes a second argument, `BehaviorEnd`, whose `answered` flag says an earlier behavior already decided. A behavior that acts on the scene itself from `onEnd` should only clean up when it is set: `momentum` now does, so `[snapBackOrDelete(…), momentum(…)]` no longer flings a node that snapped back. Code calling a behavior's `onEnd` directly must pass the second argument.
