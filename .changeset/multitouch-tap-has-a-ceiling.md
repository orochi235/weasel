---
'@weasel-js/routing': patch
'@weasel-js/gestures': patch
---

A `multiTouchTap` binding no longer fires after a long hold. Fingers that rest in place for as long as a long-press takes (500 ms, or the dispatcher's `longPress.duration`) and then lift are not a tap.
