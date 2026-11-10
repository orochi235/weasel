---
"@weasel-js/core": patch
"@weasel-js/routing": patch
"@weasel-js/ui": patch
---

Ungroup, Delete, and Cut are disabled while any node they would move, rewrite, or remove is locked, reporting the new `ActionDisabledReason.Locked` ("Contains a locked item" in the ui's reason labels), and they no longer throw from `run` in that case. Ungroup keeps every child it frees, and any group the children land in: where removing the dissolved container would take one of them as a dependent, that node drops the removed source from its `dependsOn` in the same undoable batch.
