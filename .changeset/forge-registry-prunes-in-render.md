---
'@weasel-js/forge': patch
---

A workshop whose story index loses a story now forgets that story's ready description, loaded module and load fault in the same render that drops it, rather than in a second commit after it.
