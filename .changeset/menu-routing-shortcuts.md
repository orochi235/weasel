---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`actionShortcuts` now lives in `@weasel-js/routing` (core still exports it). `evaluateEnabled` takes an optional point and passes it to `Action.enabled`, so a menu can ask whether an action applies where it was opened. `ActionsRegistry.trigger` asks `enabled` at `{ x: params.worldX, y: params.worldY }` when both are numbers, so a menu row runs under the same question it was shown enabled for. `ActionShortcut` is now an alias of `@weasel-js/menu`'s `MenuShortcut`.
