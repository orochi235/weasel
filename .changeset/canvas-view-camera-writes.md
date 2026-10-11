---
'@weasel-js/core': patch
---

An uncontrolled `<CanvasView>` no longer drops a camera write that lands before React has committed the previous one. Its camera was held in React state, so two wheel-pan steps or two frames of a drag-pan glide inside one commit each read the old camera, and the second discarded the first. The camera is now readable as soon as it is written, as on `<SceneCanvas>`.
