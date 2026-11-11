---
"@weasel-js/core": patch
---

A resize of a group holding a locked node does not start, as Ungroup and Delete are disabled for one; it used to throw on the first move.

<!-- entry: fix behavior -->
