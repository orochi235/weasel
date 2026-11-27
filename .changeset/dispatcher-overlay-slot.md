---
'@weasel-js/core': minor
---

`<SceneCanvas layers>` takes a `dispatcherOverlay` slot to style, replace or turn off the marquee, lasso and polyline overlays.

```tsx
<SceneCanvas layers={{ dispatcherOverlay: { style: { stroke: '#0a84ff', roles: { cut: { paint: { color: '#ff3b30' }, width: 2 } } } } }} />
```

`DispatcherOverlaySlotConfig` and `DispatcherOverlayStyle` are exported.

<!-- entry: new api -->
