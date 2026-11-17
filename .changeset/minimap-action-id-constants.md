---
'@weasel-js/minimap': major
---

The minimap's action-id constants end in `_ACTION_ID`, as the rest of the kit's do.

`MINIMAP_CENTER`, `MINIMAP_PAN` and `MINIMAP_ZOOM` are `MINIMAP_CENTER_ACTION_ID`, `MINIMAP_PAN_ACTION_ID` and `MINIMAP_ZOOM_ACTION_ID`; the touch zoom's is `MINIMAP_TOUCH_ZOOM_ACTION_ID`.

```ts
// before
{ spec: { kind: 'drag' }, actionId: MINIMAP_PAN }
// after
{ spec: { kind: 'drag' }, actionId: MINIMAP_PAN_ACTION_ID }
```

<!-- entry: breaking api -->
