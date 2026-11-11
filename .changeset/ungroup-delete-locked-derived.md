---
"@weasel-js/core": patch
"@weasel-js/routing": patch
"@weasel-js/ui": patch
---

Ungroup, Delete and Cut are disabled while any node they would move, rewrite or remove is locked, and no longer throw from `run` then.

They report the new `ActionDisabledReason.Locked`, labeled "Contains a locked item" in the ui's reason labels.

<!-- entry: fix api -->
