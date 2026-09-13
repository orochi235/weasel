---
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

A loupe can now be edited through. `createLoupe({ views: api, interactive: true })` makes the lens a view on the canvas: a press inside it selects the node it magnifies, and a drag moves that node by the pointer travel divided by the magnification. With `views` alone the lens paints the canvas's own stack but keeps its clicks as an eyedropper; with `source` alone it is the picture it was. A lens given `views` reads back from its canvas's `getSurfaceRect()`, so over a `paintInto` pane it samples that pane without a `region`.

Views gained what that needed. `SceneCanvasApi.addView` declares a `<CanvasView>` from outside React, and its `paint: false` hands the drawing to a host such as a HUD window. `<CanvasView view>` accepts a thunk for a camera derived from the canvas's, and `interactive={false}` makes a view paint-only. A registered layer painted over a view — a HUD window over a panel — now takes presses there instead of the view beneath, and a view no longer hit-tests registered layers it does not paint.

`hud.window({ interior: 'pass' })` gives the interior's input to what it shows while the frame stays chrome.
