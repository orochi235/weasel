---
'@weasel-js/gestures': major
---

`mods()`, `ModifierCombo` and `modifierComboToParsed` are gone from `@weasel-js/gestures`.

They built keys for the route-table grammar tools used before bindings, and covered only `mod`, `shift` and `alt`. A binding's modifiers are its spec's `mods` field.

```ts
// before
const combo = mods('shift', 'alt');            // 'shift+alt'
// after
const spec = { kind: 'click', mods: { shift: true, alt: true } };
```

<!-- entry: breaking api -->
