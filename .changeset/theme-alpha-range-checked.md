---
'@weasel-js/theme': patch
---

A token alpha outside 0 to 1 no longer writes an invalid `color-mix()`.

`fromDtcg` and `defineTheme` refuse one, `derive` reports one, and one in a hand-built theme is held to that range.

<!-- entry: fix -->
