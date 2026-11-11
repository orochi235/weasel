---
"@weasel-js/text": patch
---

`runsToMarkdown` no longer writes markers that its own reader reads as something else in a custom grammar.

Where markers on one delimiter fuse into another marker (`__` then `_` read as `___`), the change is spelled another way, such as with another delimiter between; where the grammar has no spelling for it, the flags it cannot say are dropped and the text kept. The markdown subset and grammars without such clashes write what they did.

<!-- entry: fix -->
