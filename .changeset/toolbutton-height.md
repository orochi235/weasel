---
'@weasel-js/ui': patch
---

`ToolButton` sizes itself to its icon, label and shortcut. Under a host that gives bare buttons a fixed control height (labkit does), it was held to that height and its icon spilled out above the border.
