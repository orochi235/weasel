---
'@weasel-js/core': patch
---

A `<CanvasView>` removed while a gesture was live over it left that gesture's handle orphaned: its `onEnd` never ran, so a Space-held hand tool stayed pushed and a drag preview kept its overrides. The view now cancels what is in flight on its dispatcher when it unmounts.
