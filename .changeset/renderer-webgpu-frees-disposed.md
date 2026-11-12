---
"@weasel-js/renderer": patch
---

A disposed WebGPU `WeaselRenderer` is no longer kept alive by the device it drew on. A lost device is logged once, not once per renderer.

<!-- entry: fix perf -->
