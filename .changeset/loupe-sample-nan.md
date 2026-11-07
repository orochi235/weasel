---
'@weasel-js/loupe': patch
---

A canvas source's `sample` answers `null` for a point whose x or y is NaN. Such a point passed the off-canvas check, and a browser skips a `drawImage` given a NaN rect, so the sample reported whatever pixel the previous one had read.
