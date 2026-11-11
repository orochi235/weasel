---
"@weasel-js/core": patch
---

A reorder that would shift a locked node in the stack is disabled with `Locked` instead of throwing, and Duplicate and Clone copy a group holding a locked node, keeping the copy locked, instead of throwing.
