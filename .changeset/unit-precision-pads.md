---
'@weasel-js/quantity': patch
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/routing': patch
---

A number leaf whose unit sets `precision` now shows that many places, trailing zeros included: `1.5` at `precision: 2` reads `1.50`, so a column of them lines up. The field, a menu's number row and the unit's `format` (tooltips, dialog summaries) all agree, and a leaf's own `display` still wins. Typing is left alone until the field commits. This changes what existing precision units show: the default node properties' rotation, at `precision: 1`, reads `45.0°` where it read `45°`. `resolvePrefUnit` returns the unit's `display`, and `formatUnit` takes a `pad` option (its options are exported as `FormatUnitOptions`).
