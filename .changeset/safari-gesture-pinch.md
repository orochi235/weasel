---
'@weasel-js/core': patch
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

Zoom the canvas on Safari's trackpad pinch

Safari reports a trackpad pinch as WebKit `gesturestart` / `gesturechange` /
`gestureend` events, and nothing listened for them, so the page zoomed instead
of the canvas. `useGestureDispatcher` now dispatches each `gesturechange` as a
new `pinch` gesture: `PinchSpec` (`{ kind: 'pinch', direction?: 'in' | 'out' }`),
`PinchEvent`, route-grammar name `pinch`, and `InvocationCtx.pinch`. Safari's
cumulative `scale` is turned into a per-sample step, and the focal point is
canvas-local like a wheel's. A new `pinch` entry in `DispatcherChannels` turns
the listeners off.

`viewport.zoom` binds it. Its wheel and pinch samples now share one path: each
becomes a scale factor about a focal point, so a pinch sample of 1.1 lands on
exactly the view a ctrl+wheel `deltaY` of -100 does.

Safari can send the same pinch as ctrl+wheel too. While a pinch some binding
has claimed is live, the dispatcher swallows ctrl+wheel (preventing its
default, dispatching nothing), so one pinch zooms once. When no binding claims
the pinch, the gesture events are left to the browser and ctrl+wheel reaches
its bindings as before.
