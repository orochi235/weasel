---
"@weasel-js/forge": patch
---

A component's history no longer dates a file from a history it is not part of. A file committed, then deleted or renamed away, then written again at the same path and not yet committed was given the old file's dates, its last change being the deletion; it now has none, as a file git has never committed has none.
