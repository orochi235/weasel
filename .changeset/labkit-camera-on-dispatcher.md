---
'@weasel-js/labkit': patch
'@weasel-js/core': patch
---

A labkit camera now routes through weasel's gesture dispatcher. `<CanvasStack>` and `<Stage>` pan on a drag, zoom on the wheel and report a tap through `CameraInput`, which drives core's `viewport.dragPan` and `viewport.zoom` over the camera as a weasel `View` (`toCameraView` / `fromCameraView`). The loupe joins the same dispatcher, taking the wheel while its lens is up. A trial publishes its pointer, and `RenderContext.trial.pointer` is that store; `<LinkedCursor>` draws the crosshair on the stage while the pointer is over another view.

Breaking: `usePanZoom` is removed. `PointerContextProvider` takes an optional `store`, and core exports `crosshairRects`.
