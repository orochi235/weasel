---
'@weasel-js/gestures': patch
---

`keyLegendFromKey` reads `Esc` and `Space` in any case, as shortcuts match them, so `{ key: 'Esc' }` draws ⎋ on macOS and `{ key: 'space' }` draws ␣.

<!-- entry: fix -->
