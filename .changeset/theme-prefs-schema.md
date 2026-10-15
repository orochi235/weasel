---
'@weasel-js/theme': patch
---

A theme as a prefs schema, on a new `@weasel-js/theme/prefs` entry. `themePrefsSchema(theme)` holds an `enum` for each axis under `axis` and a leaf for every token and override hook at `<group>.<token>`: a `color`, a `number` in the token's unit, or a `string` of CSS text. Each leaf may be split by every axis, and its default is what the theme resolves to, split along the axes the token differs by. `themePrefsPins(store)` reads the leaves that were set back as `pins`, a split value in `{ by, … }` form; `themeFromPrefs(store, base)` is `base` with those pins; `themePrefsSelection(store)` is the selection the axes are set to; and `themePrefsValues(store, base)` gives a form its values with each unset leaf read from the pinned theme. `@weasel-js/theme` now depends on `@weasel-js/prefs`, which only that entry loads.

`blendTheme(theme, weights, selection?)` resolves a theme partway between values of its axes: it resolves each weighted selection and mixes what every token resolved to, a color in OKLCH and a number with one unit linearly. `applyTheme` takes `{ weights }` as a fourth argument and holds that blend.
