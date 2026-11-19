---
'@weasel-js/minimap': major
---

The minimap's action factories are `createMinimapCenterAction`, `createMinimapPanAction` and `createMinimapZoomAction`.

This is a breaking rename: `minimapCenterAction`, `minimapPanAction` and `minimapZoomAction` are gone, with no alias. Their arguments and the action ids they register are unchanged.

```ts
// before
actions.register(minimapZoomAction(clamp));
// after
actions.register(createMinimapZoomAction(clamp));
```

<!-- entry: breaking api -->
