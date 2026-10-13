---
---

`apps/draw` only, no package changes: a paste that leaves shapes out now says so in a toast, with how many were dropped and why. Draw passes `onPasteOmitted` to `useClipboardOps` and `onOmitted` to `<SceneCanvas ingestion>`, and mounts a `ToastRegion` inside its workspace.
