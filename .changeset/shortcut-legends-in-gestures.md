---
'@weasel-js/gestures': patch
'@weasel-js/ui': patch
---

The shortcut formatters move from `@weasel-js/ui` to `@weasel-js/gestures`, beside `isApplePlatform`, so chrome that is not React can label a shortcut the same way: `formatShortcut`, `formatShortcutParts`, `keySpecsFromShortcut`, `keySpecsFromMods`, `keySpecFromKey`, `detectPlatform`, `MODIFIER_LABELS` and their types. `@weasel-js/ui` still exports every one of them. In gestures a key's legend is named `KeyLegend`, since `KeySpec` there is the key gesture; ui's `KeySpec` is now that type.
