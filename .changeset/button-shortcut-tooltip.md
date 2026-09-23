---
'@weasel-js/ui': patch
---

`Button` takes `shortcut` and `tooltip`, the same fields `ToggleBarItem` and `ButtonBarItem` have. `shortcut` puts a kit tooltip on the button reading `Name (⌘S)`, named by `ariaLabel` or string children, so a shortcut hint no longer needs a wrapping `title` span; `tooltip` replaces that text with any content. A button with neither renders exactly as before.
