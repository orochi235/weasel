---
'@weasel-js/core': patch
'@weasel-js/animator': patch
'@weasel-js/gestures': patch
'@weasel-js/ui': patch
---

Adds API: types that documented exports already named, and that a consumer could not import, are now exported. `@weasel-js/core`: `CameraProps`, `CanvasViewState`, `CanvasLayers`, `SceneSlotLayers`, and `OpsApplier`. `@weasel-js/animator`: `Naming`. `@weasel-js/gestures`: `Point`. `@weasel-js/ui`: `LiveControl`, `OnTokenChange`, and `OptionKey`, the `string | number` a `Select`, a `ComboBox`, and `useAsyncOptions` each declared privately as `Key`.

Adds API: `strokeRegion` in `@weasel-js/core`, the region a stroke covers along a path, which `applyOutlineStroke`'s documentation pointed at and `StrokeRegionOptions` already described.
