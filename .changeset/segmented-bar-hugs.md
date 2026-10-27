---
'@weasel-js/ui': patch
---

A `framed="segmented"` bar, and so every `ActionBar`, is now as long as its buttons. In a block host it used to run the host's full width with its buttons at the start, and a vertical one was a full-width column with its buttons centered. A host that wants it wider sizes it with its own class, which wins over the strip's sizing.
