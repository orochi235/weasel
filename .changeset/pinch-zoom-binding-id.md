---
'@weasel-js/core': major
---

`viewport.touchZoom`'s two-finger binding is named `viewport.touchZoom.multiTouch`, after the gesture it binds.

```ts
// Before
<SceneCanvas bindingOverrides={{ 'viewport.pinchZoom.pinch': unbound() }} />
// After
<SceneCanvas bindingOverrides={{ 'viewport.touchZoom.multiTouch': unbound() }} />
```

<!-- entry: breaking -->
