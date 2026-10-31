---
"@weasel-js/history": patch
---

`Journal.observe(listener)` reports each change to a journal's own entries, as `History.observe` does for a
history's, and `History.activeJournal()` (optional on the interface) answers the journal open on a history, or
`null`.
