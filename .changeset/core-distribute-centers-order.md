---
"@weasel-js/core": patch
---

Distribute by centers keeps the two outermost centers where they were and spaces the rest in the order of their centers. It used to order boxes by their leading edge, so a large box starting first could be moved, and a second run moved things again.
