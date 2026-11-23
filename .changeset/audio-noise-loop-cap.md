---
'@weasel-js/audio': patch
---

`renderNoise` and `createNoiseKernel` keep noise loops for the 8 most recently used colors and sample rates, not every one ever asked for.

<!-- entry: fix perf -->
