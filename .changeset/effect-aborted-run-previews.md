---
'@weasel-js/diagram': patch
---

`runPipeline` closes the previews it made when its signal aborts partway, so an effect runner reset mid-run no longer leaks them.

<!-- entry: fix -->
