---
"@weasel-js/core": patch
---

Align, Distribute, Flip and the four reorder commands are disabled where running them would change nothing. They report `NotApplicable`, and their `enabled` asks the same question their `run` answers: aligning one item to the selection's union, a selection already aligned or spaced, flipping in place a shape that is its own mirror, bringing forward what is already in front. A second run of align or distribute no longer records an undo step for a rounding-sized move.

<!-- entry: behavior fix -->
