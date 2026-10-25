---
'@weasel-js/text': patch
---

On the outline tier, a color emoji cluster no longer paints outlines for the code points before its closing one. A keycap such as 1️⃣ set in an outline-only face drew its digit and its variation selector under the color glyph; `paintRuns` now skips any code point whose cell has `drawsInk: false`, as `textClusters` already did.
