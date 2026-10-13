---
'@weasel-js/core': patch
---

Fixes: a `clientToWorld` override on the canvas was ignored by `<SceneCanvas>`'s own pointer handling. Gesture dispatch, the pointer store, and hover now convert through the canvas handle, so the override applies to all three.

Breaking: `CanvasExtensionApi.clientToWorld` is required where it was optional. It only affects code that builds a handle by hand, such as a test fake.

Removes: `canvas/toolPreview.ts`, which had no caller once tools stopped publishing previews.
