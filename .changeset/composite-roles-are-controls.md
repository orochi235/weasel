---
'@weasel-js/gestures': patch
---

A press on a `<summary>`, a tab, an option or a radio inside a list row or over a canvas is left to it, as a press on a button is.

The same holds for `menuitemcheckbox` and `menuitemradio`, and Space and Enter on a radio or either menu item also stay with it. A surface that drives such children itself passes `controls: 'take'`.

<!-- entry: fix behavior -->
