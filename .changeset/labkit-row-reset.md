---
'@weasel-js/labkit': minor
---

Every `ControlPanel` row offers a reset, and a group reset puts the leaves that start auto back to auto.

A write of a group's value pins every leaf under it except one it holds the `auto` sentinel at, so a group reset stays one write and one undo step. An auto row with an `auto.value` and no resolver draws that value.

<!-- entry: new behavior visual -->
