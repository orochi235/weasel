---
'@weasel-js/ui': patch
---

`ToggleBarItem` and `ButtonBarItem` take `shortcut` and `tooltip`, so a segmented bar can show shortcut hints. `shortcut` puts a kit tooltip on the segment reading `Name (⌘B)`, named by `ariaLabel` or a string `label` — the same form `ToolButton` and `ActionBar` use. `tooltip` replaces that text with any content. Items with neither render exactly as before, and arrow-key navigation is unchanged.
