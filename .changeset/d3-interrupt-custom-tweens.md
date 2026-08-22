---
'@weasel-js/d3': patch
---

`selection.interrupt()` now stops custom tweens, not just the pose tween

`animator.cancelKey` matches a key exactly. Pose tweens are keyed
`d3-transition:<name>:<id>` and custom `.tween()` declarations add a
`:<tweenName>` suffix, so the selection-level `interrupt(name)` — which built
the pose key and cancelled that alone — never reached them. A transition
carrying a custom tween kept applying values after it was interrupted. The
live custom keys are now tracked as they spawn and drained when interrupted.

The existing coverage asserted the namespace claim using a transition that
had only a pose tween, which is why it passed.
