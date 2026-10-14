---
'@weasel-js/core': patch
---

`SceneCanvasApi.ingest` works from the canvas's first render. It reached the action registry through a ref an effect filled, so a call made before that effect ran was dropped with a warning.
