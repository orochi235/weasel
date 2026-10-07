---
'@weasel-js/labkit': patch
---

A camera can be told which gestures to take: `gestures: { pan, wheel, pinch, tap }` on `<CanvasStack>`, `<Stage>` and `<CameraInput>`, on an instrument's `canvas` or `stage`, and on `<Lab>`, whose keys win over the instrument's one by one. `wheel` is `'plain'` (the default), `'mod'` for Cmd/Ctrl+wheel only, or `false`; `pinch` covers a trackpad pinch and, new here, a two-finger pinch on a touch screen. A gesture the camera does not take is never claimed, so the page gets it — `<Lab present gestures={{ pan: false, wheel: false }}>` is an embed the page scrolls past — and the camera's `touch-action` follows: `none` while a finger pans it, `pan-x pan-y` once it does not, `auto` when it takes no touch at all.
