---
'@weasel-js/minimap': minor
---

A two-finger touch pinch over the minimap zooms the main view about the point between the fingers.

The main view follows the fingers as it follows a one-finger pan. It clamps as the wheel and trackpad pinch do, to the limits `zoom` gives or the kit defaults. A finger already panning hands its pan to the pinch when a second lands, and takes it back from where the pinch left the view when that one lifts. The action is exported as `minimapPinchAction` (`minimap.pinch`), bound as `<id>.multiTouch`; it reads the minimap's own camera as the `view` dep, which `<MinimapCanvas>` now publishes beside `rootView`, as a `<CanvasView>` does on a surface.

<!-- entry: rank=10 new api -->
