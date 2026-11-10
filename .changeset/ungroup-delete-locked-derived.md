---
"@weasel-js/core": patch
"@weasel-js/routing": patch
"@weasel-js/ui": patch
---

Ungroup, Delete, and Cut are disabled while any node they would move, rewrite, or remove is locked, reporting the new `ActionDisabledReason.Locked` ("Contains a locked item" in the ui's reason labels), and they no longer throw from `run` in that case. Ungroup no longer deletes anything through a dissolved group's dependents: every node deriving from the group, a freed child or a node elsewhere, drops the group from its `dependsOn` in the same undoable batch, where before it was deleted with the group.
