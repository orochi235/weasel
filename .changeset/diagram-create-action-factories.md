---
'@weasel-js/diagram': major
---

diagram's remaining action factories are named `create…Action`, like the rest.

`editEdgeLabelAction`, `editContainerTitleAction` and `routerActions` are renamed `createEditEdgeLabelAction`, `createEditContainerTitleAction` and `createRouterActions`; their arguments are unchanged.

```ts
// before
actions: [editEdgeLabelAction({ fill: theme.label.fill })],
// after
actions: [createEditEdgeLabelAction({ fill: theme.label.fill })],
```

<!-- entry: breaking api -->
