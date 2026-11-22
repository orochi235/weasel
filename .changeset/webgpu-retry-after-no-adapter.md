---
'@weasel-js/renderer': patch
---

`requestRendererDevice` asks again after a request that found no GPU adapter, so WebGPU comes back once a lost GPU restarts.

<!-- entry: fix -->
