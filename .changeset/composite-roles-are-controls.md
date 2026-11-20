---
'@weasel-js/gestures': patch
---

A press on a `<summary>`, or on an element with role `tab`, `option`, `radio`, `menuitemcheckbox` or `menuitemradio`, inside a list row or over a canvas is left to that element, as a press on a button is.

Space and Enter on a `radio`, `menuitemcheckbox` or `menuitemradio` element also stay with it. A surface that drives such children itself passes `controls: 'take'`.

<!-- entry: fix behavior -->
