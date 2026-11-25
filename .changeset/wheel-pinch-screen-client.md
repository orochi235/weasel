---
'@weasel-js/routing': minor
'@weasel-js/gestures': minor
---

`ctx.screen` on a wheel or a trackpad pinch is the pointer in client pixels, as on every other input, rather than its canvas-local point.

`WheelEvent` and `PinchEvent` take an optional `screen`, the client point; the dispatcher fills it, and `clientX`/`clientY` stay canvas-local.

<!-- entry: fix api -->
