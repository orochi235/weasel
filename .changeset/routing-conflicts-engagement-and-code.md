---
"@weasel-js/routing": patch
---

`findConflicts` and `reportRouteConflicts` report two more kinds of tie. One is between two owners' bindings that fire together only while one owner is engaged and the other is idle, such as one owner's `engaged` binding against another's `initial` one on the same key. The other is between key bindings whose `code`s overlap, whatever keys they name. A pair that meets on several keys or codes is reported once.
