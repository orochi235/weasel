---
'@weasel-js/labkit': patch
---

A `ControlMatrix` popover row drew its label as a focusable toggle named "Pin …" that did nothing when pressed, since a matrix has no auto state. The label is a plain label now.
