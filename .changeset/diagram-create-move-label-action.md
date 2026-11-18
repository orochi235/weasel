---
'@weasel-js/diagram': major
---

The factory for the `diagram.moveLabel` action is `createMoveLabelAction`, named for the action it registers.

`createLabelDragAction` and `LabelDragOptions` are renamed `createMoveLabelAction` and `MoveLabelOptions`; the options are unchanged.

```ts
// before
actions: [createLabelDragAction({ commit })],
// after
actions: [createMoveLabelAction({ commit })],
```

<!-- entry: breaking api -->
