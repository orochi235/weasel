---
'@weasel-js/ui': patch
---

`BandEditor`, `Timeline` and the curve editor's keyframe layer now snap through one shared `snapToNearest` and one 6px radius. No behavior change; `snapToNearest` and `snapTime` are exported from the same places as before.
