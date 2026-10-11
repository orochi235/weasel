---
'@weasel-js/labkit': patch
---

A text control in `ControlPanel` or `ControlMatrix` lost what was typed when its row went away inside the debounce window: closing a matrix cell's popover, switching tabs, or a `showIf` hiding the row right after the last key. The pending text is now written as the row unmounts. Text still waiting is also dropped when the value is replaced from outside, so a reset is no longer overwritten by the keystrokes before it.
