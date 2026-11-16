---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

Editing's tools and commands draw their glyphs from editing's own `editing` icon namespace, so `core:rect` and the others are `editing:rect`.

This is breaking for code that names one of these glyphs: write `icon('editing:rect')` where it wrote `icon('core:rect')`. They move: `alignBottom`, `alignCenterX`, `alignCenterY`, `alignLeft`, `alignRight`, `alignTop`, `booleanGroup`, `bringForward`, `bringToFront`, `crop`, `divide`, `duplicate`, `ellipse`, `eyedropper`, `flipX`, `flipY`, `group`, `lasso`, `line`, `merge`, `polygon`, `rect`, `select`, `sendBackward`, `sendToBack`, `star`, `transformAgain`, `trim`, `ungroup`. Core keeps the hand, history, cut, copy and paste, the booleans its own nodes name (union, intersect, subtract, exclude), and the path, text and paint glyphs. `@weasel-js/editing/icons` exports editing's table, and its `weaselIcons` field points the build plugin at it.

<!-- entry: rank=5 breaking -->
