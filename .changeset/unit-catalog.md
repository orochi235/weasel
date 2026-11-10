---
"@weasel-js/quantity": patch
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
"@weasel-js/menu": patch
"@weasel-js/labkit": patch
"@weasel-js/diagram": patch
---

A unit catalog in `@weasel-js/quantity`: one entry per unit with its canonical name, its symbol, a compact form for tight spaces (`″` for `in`, `′` for `ft`), the aliases that read as it, its spoken names or `Intl` unit, its CSS unit, and whether its glyph attaches to the number (`°`, `′`, `″`, `%`). `catalogUnit`, `unitSymbol`, `unitSpellings`, `withUnit`, and `speakUnit` read it, and `registerUnit` adds or replaces a unit and returns a function that takes it back out. The `unit` display, the bytes and duration displays' speech, `parseNumber`'s alternate spellings, and `prefsCss`'s CSS units all read the catalog now, in place of the tables each kept.

`UnitDisplay` and a prefs unit take `compact: true` for a unit's compact form, and a unit is written as the catalog writes it, so `unit('deg')` and a prefs unit with `suffix: 'deg'` show `°`.

In `@weasel-js/ui`, a field's or readout's unit whose glyph attaches stays on the value's line in every layout, an inline slider row that hangs word units below its readout included, and is out of flow, so the field is the same size with it as without and nothing after it moves. The catalog decides which units attach: a property field's string `unit`, a menu number row's `suffix`, and a read-only readout all ask it. `QuantityText`'s `unit` takes `compact` and marks an attaching unit `data-attach`.

Breaking: `unit('"')` now shows `12″` and `unit("'")` shows `1′`, the compact forms those marks are aliases of, and a unit named by an alias shows its symbol (`deg` shows `°`). A degree passed as `<sup>°</sup>` still draws as given but no longer attaches; pass the string `'°'`. `ResolvedPrefUnit.suffix` is the text a field shows, the catalog's form of the one written. Typed text now reads every spelling the catalog knows for a unit a table accepts, so a field accepting `deg` also reads `°`. A scale indicator's label is now spoken through the catalog, `Scale: 10 feet`.
