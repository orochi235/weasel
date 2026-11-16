---
'@weasel-js/core': minor
---

A content handler registered under an id another holds stands in for it until released, and only the live handler of each id runs.

Two handlers sharing an id used to both run. Give each handler that should run its own id.

<!-- entry: behavior -->
