---
'@weasel-js/routing': patch
---

`browserReservedChord` reads a punctuation, Space or numpad digit `code` as the key it types, so `{ code: 'BracketLeft', mods: { mod: true } }` is reported as Cmd+[ on macOS.

<!-- entry: fix -->
