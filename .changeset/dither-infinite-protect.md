---
"@weasel-js/dither": patch
---

`protectMask` protects every pixel under a rect that runs from minus to plus infinity, as `protectRects` makes of a large document rect on a fine grid. Its far edge summed to `NaN`, and the rect protected nothing.
