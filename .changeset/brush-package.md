---
'@weasel-js/brush': patch
---

New package: `@weasel-js/brush`. `shareBrushSize(options)` is the share that keeps a brush's size option under the `BRUSH_SIZE_PX` key; handed to each brush tool's `share` option, it gives them all one size, held to each tool's own bounds. A brush's size stays its own otherwise. Breaking: `linkBrushSize`, `SHARED_BRUSH_SLOT`, and `SHARED_BRUSH_SIZE` are gone; sharing is now an ordinary tool option share.
