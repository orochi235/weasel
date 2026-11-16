---
'@weasel-js/renderer': patch
---

`requestRendererDevice` warns when asking for a WebGPU device fails, and asks again on the next call rather than for the rest of the page.

It still resolves `null` on a failure.

<!-- entry: fix -->
