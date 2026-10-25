---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A group or section its `enableIf` turns off now dims its tab's name, and a bar's lead label or icon, the way its heading already dimmed. `GroupTab` and `BarLayout` take a new `disabled` prop for this; `PrefsForm`, `SelectionPanel`, and `ControlPanel` fill it in.
