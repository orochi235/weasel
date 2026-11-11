---
"@weasel-js/core": patch
---

Align, Distribute, Flip, and the four reorder commands are disabled (`NotApplicable`) where running them would change nothing, and their `enabled` asks the same question their `run` answers: aligning one item to the selection's union, a selection already aligned or spaced, a flip in place of a shape that is its own mirror, bringing forward what is already in front. Align and distribute also no longer commit a rounding-sized move on a second run, which used to record an undo step that changed nothing visible.
