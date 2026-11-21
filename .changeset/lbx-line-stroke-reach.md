---
'@weasel-js/p-touch': patch
---

`writeLbx` rasterizes a polyline whose stroke, caps, or mitered corners reach past the label's ends, as it does a rect. P-touch no longer grows an auto-length label for a line's cap.

<!-- entry: fix -->
