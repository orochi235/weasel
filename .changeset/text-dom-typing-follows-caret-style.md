---
"@weasel-js/text-dom": patch
---

A character typed in the edit overlay takes the styling `rangeStyle` reports at the caret. Typing after a character written under an armed style (Cmd+B, then a word) used to give only that first character the style and the rest of the word no run styling at all, not even the run's it was typed into; the whole word now takes it, and pressing the shortcut again ends it. A caret between two run spans types in the style of the run before it, as it reports, rather than in none.
