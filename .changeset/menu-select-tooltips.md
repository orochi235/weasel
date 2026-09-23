---
'@weasel-js/ui': patch
---

`MenuButton` and `Select` take `shortcut` and `tooltip`, the same fields `Button`, `ToggleBarItem` and `ButtonBarItem` carry. `shortcut` puts a kit tooltip on the trigger reading `Name (⌘N)`, named by `aria-label` or a string `label`; `tooltip` replaces that text with any content. A trigger with neither renders exactly as before, and opening the menu or list is unchanged.
