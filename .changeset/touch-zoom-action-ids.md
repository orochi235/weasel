---
'@weasel-js/core': major
---

The two-finger touch zoom action is `viewport.touchZoom`, after what it does: `viewport.zoom` takes the `pinch` gesture.

`viewport.pinchZoom` is `viewport.touchZoom` (binding `viewport.touchZoom.multiTouch`); `pinchZoomAction`, `createPinchZoomAction` and `PinchZoomOptions` are `touchZoomAction`, `createTouchZoomAction` and `TouchZoomOptions`; and the `viewport` prop's `pinchZoom` is `touchZoom`.

```tsx
// before
<SceneCanvas viewport={{ pinchZoom: { max: 16 } }} actions={{ 'viewport.pinchZoom': null }} />
// after
<SceneCanvas viewport={{ touchZoom: { max: 16 } }} actions={{ 'viewport.touchZoom': null }} />
```

<!-- entry: breaking api -->
