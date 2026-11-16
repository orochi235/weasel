---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

`deleteAction`, `createDeleteAction` and their helpers move from `@weasel-js/core` to `@weasel-js/editing`.

This is breaking: import `deleteAction`, `createDeleteAction`, `DeleteActionOptions`, `commitDeleteToScene` and `hiddenSourceDeleteOps` from `@weasel-js/editing`. `deletePreset` and the standard edit presets carry the action as before.

<!-- entry: rank=20 breaking api -->
