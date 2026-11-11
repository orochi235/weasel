---
"@weasel-js/text": patch
---

`runsToMarkdown` no longer writes markers that its own reader reads as something else. In a custom grammar where markers on one delimiter written in a row fuse into a run that means another marker (`__` then `_` reading as a `___` marker), the change is spelled another way, such as with another delimiter between; where the grammar has no spelling for it, the flags it cannot say there are dropped and the text is kept, rather than restyling the text with a flag it never had. The markdown subset and grammars without such clashes write exactly what they did.
