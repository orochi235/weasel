---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

`ControlPanel` draws a row whose `enableIf` fails with its control disabled and its label dimmed, for a condition written as data and for one written as a function. A group's `enableIf` disables every row under it. It reaches a row's own control, a heading's control, the cells of a paired row and of a group drawn `as: 'bar'`, an action's button, the button of a row that opens a dialog, and a custom control, whose context now carries `disabled`.

`isLeafVisible` and `isLeafEnabled` now answer for everything above a path as well as the node at it: a path under a hidden group is not visible, and one under a disabled group is not enabled. Both ask `prefScopeAt` in `@weasel-js/prefs` for the conditions the schema carries as data, and add the functions beside the tree. Behavior change for a caller that asked about a nested path on its own and expected only that node's condition.

Adds API: `DialogRow` takes `disabled`, which disables its button and dims its label. `ControlMatrix` does not read `showIf` or `enableIf`.
