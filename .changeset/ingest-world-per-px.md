---
'@weasel-js/core': minor
---

`IngestCtx` and the `ingestion` dep carry an optional `worldPerPx()`: the world distance one CSS px spans along each screen axis.

A content handler placing in screen terms multiplies by it; `<SceneCanvas>` and `<CanvasView>` supply it, and `arrivalBounds` reads it.

<!-- entry: api -->
