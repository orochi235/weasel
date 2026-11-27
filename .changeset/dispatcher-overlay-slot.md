---
'@weasel-js/core': minor
---

`<SceneCanvas layers>` takes a `dispatcherOverlay` slot that styles the marquee, lasso and polyline overlays, replaces them with a layer of your own, or turns them off.

```tsx
<SceneCanvas layers={{ dispatcherOverlay: { style: { stroke: '#0a84ff', roles: { cut: { paint: { color: '#ff3b30' }, width: 2 } } } } }} />
```

`DispatcherOverlaySlotConfig` and `DispatcherOverlayStyle` are exported.

<!-- entry: new api -->
