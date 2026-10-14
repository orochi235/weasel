---
'@weasel-js/labkit': patch
---

A stored trial or snapshot that fails to load is listed in the lab, in a strip above the workspace, with a Discard button that deletes its record. It used to be left out with only a console warning, and nothing could remove the record. Additive: the lab store holds the list as `unreadable` and deletes one with `discardUnreadable(kind, id)`; `UnreadableRecord` is the entry's type. A record another tab stores unreadably is listed too, and unlisted once that tab stores it readably or deletes it.
