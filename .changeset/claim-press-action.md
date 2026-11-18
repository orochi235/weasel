---
'@weasel-js/diagram': major
---

`grabPortAction` and `grabPortBindings` are `createClaimPressAction` and `claimPressBindings`, since they claim a press on any affordance.

Their arguments are unchanged; `GRAB_PORT_ACTION_ID` is still the default id.

```ts
// before
actions: [grabPortAction(GRAB_LABEL_ACTION_ID)], bindings: grabPortBindings(GRAB_LABEL_ACTION_ID, kind)
// after
actions: [createClaimPressAction(GRAB_LABEL_ACTION_ID)], bindings: claimPressBindings(GRAB_LABEL_ACTION_ID, kind)
```

<!-- entry: breaking api -->
