---
'@weasel-js/core': patch
---

A render worker whose canvas cannot be handed over is terminated and stops watching the scene, and the original error is rethrown.

The same holds when the first message to the worker cannot be posted.

<!-- entry: fix -->
