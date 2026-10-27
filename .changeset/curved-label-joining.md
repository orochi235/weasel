---
'@weasel-js/ui': patch
---

`CurvedLabel` draws Arabic and the other joining scripts joined. Letters that join one another now share one span,
shaped by the browser and laid along the curve by its measured width, where each used to stand in a span of its own
and show its isolated form. A word breaks into such stretches after each letter that joins only the one before it
(alef, dal, ra, waw and the like), so the stretches are short and still follow the curve.
