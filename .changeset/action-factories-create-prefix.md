---
'@weasel-js/core': major
'@weasel-js/routing': major
---

The action factories that were spelled `make…` are `create…`, like `createResizeAction` and `createDeleteAction`.

`makeViewportZoomAction`, `makeViewportWheelPanAction`, `makePinchZoomAction` and `makeHandleCommand` (core) and `makeToolOffhandAction` (routing) are renamed; their arguments are unchanged.

```ts
// before
const zoom = makeViewportZoomAction({ min: 0.1, max: 8 });
// after
const zoom = createViewportZoomAction({ min: 0.1, max: 8 });
```

<!-- entry: breaking api -->
