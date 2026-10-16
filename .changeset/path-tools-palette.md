---
'@weasel-js/ui': patch
'@weasel-js/path-tools': patch
---

`ToolPalette` takes `include`, a filter over the registered tools, and `ariaLabel`, the toolbar's accessible name (default `"Tools"`). Two palettes over one `tools` with complementary filters split a canvas's tools between two toolbars; WeaselDraw shows path-tools' tools in a strip of their own this way.

Envelope mesh's tool key is now Shift+F, beside Distort's F. It was C, which WeaselDraw's crop mode already holds, so the key never reached it there.
