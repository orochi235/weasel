---
'@weasel-js/gestures': major
'@weasel-js/ui': major
---

The helpers that turn a shortcut into the keys a keycap draws say `keyLegend`, not `keySpec`, which names a key binding's gesture.

ui's `KeySpec` type is gone; it was another name for gestures' `KeyLegend`, which ui's Keycaps entry now exports. The functions and their options type are renamed; their arguments are unchanged.

| Before | After |
|---|---|
| `KeySpec` (ui) | `KeyLegend` |
| `keySpecsFromMods` | `keyLegendsFromMods` |
| `keySpecFromKey` | `keyLegendFromKey` |
| `keySpecsFromShortcut` | `keyLegendsFromShortcut` |
| `keySpecFromCode` | `keyLegendFromCode` |
| `KeySpecsFromModsOptions` | `KeyLegendOptions` |
| `keySpecsFromChord` (ui) | `keyLegendsFromChord` |
| `keySpecsFromLegend` (ui) | `keyLegendsFromFormatted` |

```ts
// before
const keys: KeySpec[] = keySpecsFromLegend('⇧⌘Z');
// after
const keys: KeyLegend[] = keyLegendsFromFormatted('⇧⌘Z');
```

<!-- entry: breaking api -->
