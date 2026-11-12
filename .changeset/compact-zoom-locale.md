---
'@weasel-js/quantity': minor
---

The `compact` and `zoom` displays write and read their number in the locale they are given: `40,0K` and `2,5x` in `de-DE`.

`formatCompact(value, decimals, locale)` takes the locale as a third argument, `en-US` by default. The `K`/`M`/`B`/`T` suffix stays as it is in every locale, since `parseNumber` reads it and `Intl`'s own compact words (`2 Mio.`) would not read back.

<!-- entry: api behavior -->
