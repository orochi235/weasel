---
"@weasel-js/core": patch
---

`usePinchGesture` is removed. This is a breaking change for anyone importing it. It attached its own pointer
listeners beside the gesture dispatcher, which already handles a two-finger touch pinch: its `multitouch` channel
carries the centroid and spread of the held pointers, and `viewport.pinchZoom` (`pinchZoomAction` /
`makePinchZoomAction`) binds to it. Bind an action to `{ kind: 'multiTouch', fingers: 2 }` in place of the hook.
