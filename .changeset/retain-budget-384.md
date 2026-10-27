---
'@weasel-js/renderer': patch
---

`DEFAULT_RETAIN_BUDGET` is 384 MiB, up from 256. With the smaller scratch buffer a frame peaks lower than before, and 16 canvas-sized world layers at 1280x800 and dpr 2 now get the margins a pan needs: a pan frame costs 0.35 of submitting them, where it cost 0.98.
