---
'@weasel-js/ui': patch
---

A `ToolbarDock` row too narrow for its bars no longer squeezes a short bar past its only item: each menu-overflow bar reports the least length that keeps its only item or its More button, its slot shrinks no shorter, and the longer bars give up their items first.
