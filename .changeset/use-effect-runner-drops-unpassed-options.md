---
'@weasel-js/diagram': patch
---

`useEffectRunner` lets go of `sources`, `kinds`, `previews` or `previewSize` once the caller stops passing it, so the next run uses the default.

<!-- entry: fix -->
