---
'@weasel-js/core': major
---

`viewport.pinchZoom`'s two-finger binding is named `viewport.pinchZoom.multiTouch`, after the gesture it binds.

```ts
// Before
<SceneCanvas bindingOverrides={{ 'viewport.pinchZoom.pinch': unbound() }} />
// After
<SceneCanvas bindingOverrides={{ 'viewport.pinchZoom.multiTouch': unbound() }} />
```

<!-- entry: breaking -->
