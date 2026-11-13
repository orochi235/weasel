---
'@weasel-js/ui': minor
---

Every `PrefsForm` and `PrefsDialog` row offers a reset while its leaf differs from its reset, and a `resettable` group's heading resets it.

A reset goes through the new `onReset(path)` prop where it is given (a store's `reset`); without it the form resets through `onAutoChange` and `onChange`. `PropertyRow`, `PropertyField` and `DialogRow` take `onReset`, and draw the new `ResetControl` after the label.

<!-- entry: rank=5 new api visual -->
