---
'@weasel-js/diagram': major
---

Three action-id constants are spelled in the same order as their ids, verb first.

`ROUTE_EDIT_ACTION_ID` (`'diagram.editRoute'`), `LANE_RESIZE_ACTION_ID` (`'diagram.resizeLane'`) and `ITEM_DROP_ACTION_ID` (`'diagram.dropItem'`) are renamed `EDIT_ROUTE_ACTION_ID`, `RESIZE_LANE_ACTION_ID` and `DROP_ITEM_ACTION_ID`. The ids are unchanged.

```ts
// before
bindings: [{ spec: { kind: 'drag' }, actionId: ROUTE_EDIT_ACTION_ID }],
// after
bindings: [{ spec: { kind: 'drag' }, actionId: EDIT_ROUTE_ACTION_ID }],
```

<!-- entry: breaking api -->
