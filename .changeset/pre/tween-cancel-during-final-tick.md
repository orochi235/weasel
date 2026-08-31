---
'@weasel-js/core': patch
---

`Animator.tween` no longer fires `onDone` for a tween that was cancelled during
its own final `onTick`. The last tick emitted the value and completed in one
pass, so a write made from that tick — cancelling the tween — still got the
completion callback, against the documented "not called on cancel" contract.
