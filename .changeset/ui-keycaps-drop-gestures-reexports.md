---
'@weasel-js/ui': major
---

`@weasel-js/ui` no longer re-exports gestures' key-spec helpers; import them from `@weasel-js/gestures`.

That is `keySpecsFromMods`, `keySpecFromKey`, `keySpecFromCode`, `keySpecsFromShortcut`, and `detectPlatform`. The types that came with them (`LogicalMod`, `LogicalModSpec`, `Platform`, `LegendStyle`, `KeySpecsFromModsOptions`, `KeyLabels`) move the same way, from the root barrel and from `@weasel-js/ui/components/Keycaps`. `KeySpec`, `KeyCap`, `KeySequence`, and the rest of Keycaps stay.

```ts
// before
import { KeySequence, keySpecsFromShortcut } from '@weasel-js/ui/components/Keycaps';
// after
import { KeySequence } from '@weasel-js/ui/components/Keycaps';
import { keySpecsFromShortcut } from '@weasel-js/gestures';
```

<!-- entry: breaking api -->
