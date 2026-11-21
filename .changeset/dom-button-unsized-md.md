---
'@weasel-js/ui': patch
---

`domButton.draw` renders a button with no `size` at `md`, the size `domButton.measure` lays it out at, even inside a `ControlSizeScope`.

Inside a scope, pass the scope's size as `size` to both.

<!-- entry: fix behavior -->
