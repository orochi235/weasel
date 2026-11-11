---
"@weasel-js/text-dom": patch
---

A character typed in the edit overlay takes the styling `rangeStyle` reports at the caret, so a word typed after Cmd+B is bold throughout.

Pressing the shortcut again ends it. A caret between two run spans types in the style of the run before it.

<!-- entry: fix -->
