---
"@weasel-js/registry": patch
---

`matchQuery` composes the query and every field before comparing, so `é` finds text that spells it `e` followed by a combining acute (as macOS file names do), and the reverse. A query or text written either way gets the same answer.
