---
"@weasel-js/renderer": patch
---

A disposed WebGPU `WeaselRenderer` is freed rather than kept alive by the device it drew on, and a lost device is logged once rather than once per renderer.

<!-- entry: fix perf -->
