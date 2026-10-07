# @weasel-js/quantity

## 1.8.1

No changes in this release.

## 1.8.0

### Patch Changes

- 2432ce3: Quantities can be infinite. Every display shows ±Infinity as `∞`, spoken "infinity", and reads `∞`, `inf` and `infinity` back; `endless(display, 'never')` gives a display its own word, shown without a unit beside it and read back when typed. A zoom display used to print `Infinity` here.
  
  A slider can make an end stand for infinity. `Slider` and `PropertyField` take `endless: 'max' | 'min' | 'both'`: the end stop reports ±Infinity, a value of ±Infinity sits there, and the readout shows the display's word. A number pref leaf takes `endless` and `infinity` (its word), and labkit's number builder takes `.endless('never')`, so `f.number(Infinity).range(0, 5000).suffix('ms').endless('never')` reads "never" at the top of its track instead of "5000 ms".

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

- 51eb721: `parseNumber` and the display parsers now read the digits a locale writes in, so `١٬٢٣٤` typed in `ar-EG` is 1234 rather than NaN. A duration typed on the clock takes the locale's decimal mark before its fraction of a second, so `4:05,5` reads as 245.5 in `de-DE`.

## 1.7.0

### Patch Changes

- f257369: `fraction()` gains two options. `form: 'diagonal'` writes the fraction as superscript digits, the fraction slash and subscript digits (`¹⁄₁₂`), so it stays diagonal wherever the text is drawn, and every fraction display reads that form back. `of` counts in a named constant: `fraction({ of: 'π' })` shows `3π/4`, speaks `3 pi over 4` and reads `3pi/4` back; `π`, `τ` and `e` are built in as `CONSTANTS`, and any `{ symbol, value, spoken }` works. `of` cannot be combined with `mixed`.
  
  Unit fields that accept `in` or `ft` now also accept `"` and `'`, the primes, and the curly quotes a keyboard substitutes for them, and the reverse; `unit('"')` shows inches with the mark and speaks them as inches.
- 408ce25: Typed text reads in the display's locale. `parseNumber` takes a locale, and every display kind passes its own, so what a display shows in `de-DE` (`1.234,5`), `fr-FR` (`1 234,5`), `de-CH` (`1'234.5`) or `en-IN` (`12,34,567`) parses back to the same value. A locale that groups with a space accepts any space there, and `'` and `’` stand in for each other. Where the locale's reading fails the `en-US` one is tried, so `1.5` is still one and a half in `de-DE`; where both succeed, the locale's wins.
  
  A compound unit value reads a grouped number in any term: `1,500ft 3in` is 18,003 inches, where it used to be NaN.
- 455e4bc: New package, `@weasel-js/quantity`: a number anywhere the engine takes one can be bare or tagged (`{ value, unit?, display? }`), and a tagged value keeps its unit and display through JSON, history and every edit (`retag`). A display is plain data — `fraction()`, `ratio()`, `percent()`, `unit('mm')`, `currency('USD')`, `duration()`, `bytes()`, `roman()`, `ordinal()`, `multiplier()`, `zoom()`, `compact()`, `decimal()`, `integer()` — and `qty(value, display)` gives its text, spoken text, unstyled HTML and, for fractions, MathML. `registerDisplayKind` adds a kind or replaces a built-in one.
  
  Breaking: the unit system (`UnitSystem`, `resolveUnit`, `formatUnit`, …) now lives in `@weasel-js/quantity`; core still re-exports the same names. `formatNumber`, `formatCompact`, `parseNumber`, `parseSignedNumber` and `MINUS_SIGN` are no longer exported from `@weasel-js/ui` — import them from `@weasel-js/quantity`. `formatZoom` is gone: use `qty(z, zoom()).text`. A pref's `format: 'plain' | 'compact'` is now `display: Display` (`ToolPrefNumberFormat` and `PrefNumberFormat` are removed), `PropertyField`'s `notation` is now `display`, and labkit's `f.number().format('compact')` is `.display(compact())`.
  
  `PropertyField`, `UnitField`, `Slider` and `BandEditor` take a `display`, which drives what they show, what they read back when typed, and their `aria-valuetext`. A `BandEditor` seam at 1/12 with `display={fraction()}` announces "1 over 12" rather than `0.08333333333333333`, and a band whose `from` is tagged stays tagged through drags, splits and merges. The Timeline rate slider now speaks "4 times" rather than "4x".
