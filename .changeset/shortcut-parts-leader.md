---
"@weasel-js/gestures": patch
"@weasel-js/ui": patch
---

Keycaps draw a key's leader path. `formatShortcutParts` now returns `{ leader, keys }`: the keymaps
leading to the key, outermost first, each with its label and its leader's chips, then the key's own
chips as `KeyLegend`s, so an optional shift arrives marked. `formatShortcut` is built on it, and
`SHORTCUT_LEADER_SEPARATOR` is the ` ▸ ` it writes. `KeySequence` takes a `leader` prop and draws each
step's label before the keys (`Loupe ▸ 2`). `ShortcutKeys` takes a `shortcut` as data as well as a
`legend`, and reads the leader path out of a legend `formatShortcut` wrote; `<KeymapHint>` and the
command palette draw through them.

Breaking: `formatShortcutParts` used to return a flat `string[]` of key labels. Its `keys` field is
that list as `KeyLegend`s; read `.keys.map((k) => k.label)` for the old shape.
