---
'@weasel-js/svg': patch
---

`serializeSvg` says each `<defs>` warning once per call, as it does the rest, rather than once per texture fill or marker.

<!-- entry: fix -->
