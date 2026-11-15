---
'@weasel-js/core': major
'@weasel-js/diagram': major
---

A move, nudge, rotate, resize, flip, align or distribute leaves a node stored in a singular frame where it is and transforms the rest.

No stored pose in a frame scaled to nothing follows the edit, so such a node is not written. Path edits, slicing and boolean operations pass it over too, and a layout pass does not move it.

<!-- entry: behavior -->
