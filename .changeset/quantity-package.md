---
'@weasel-js/quantity': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

New package, `@weasel-js/quantity`: a number anywhere the engine takes one can be bare or tagged (`{ value, unit?, display? }`), and a tagged value keeps its unit and display through JSON, history and every edit (`retag`). A display is plain data — `fraction()`, `ratio()`, `percent()`, `unit('mm')`, `currency('USD')`, `duration()`, `bytes()`, `roman()`, `ordinal()`, `multiplier()`, `zoom()`, `compact()`, `decimal()`, `integer()` — and `qty(value, display)` gives its text, spoken text, unstyled HTML and, for fractions, MathML. `registerDisplayKind` adds a kind or replaces a built-in one.

Breaking: the unit system (`UnitSystem`, `resolveUnit`, `formatUnit`, …) now lives in `@weasel-js/quantity`; core still re-exports the same names. `formatNumber`, `formatCompact`, `parseNumber`, `parseSignedNumber` and `MINUS_SIGN` are no longer exported from `@weasel-js/ui` — import them from `@weasel-js/quantity`. `formatZoom` is gone: use `qty(z, zoom()).text`. A pref's `format: 'plain' | 'compact'` is now `display: Display` (`ToolPrefNumberFormat` and `PrefNumberFormat` are removed), `PropertyField`'s `notation` is now `display`, and labkit's `f.number().format('compact')` is `.display(compact())`.

`PropertyField`, `UnitField`, `Slider` and `BandEditor` take a `display`, which drives what they show, what they read back when typed, and their `aria-valuetext`. A `BandEditor` seam at 1/12 with `display={fraction()}` announces "1 over 12" rather than `0.08333333333333333`, and a band whose `from` is tagged stays tagged through drags, splits and merges. The Timeline rate slider now speaks "4 times" rather than "4x".
