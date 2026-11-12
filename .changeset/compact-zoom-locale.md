---
'@weasel-js/quantity': minor
---

The `compact` and `zoom` displays write their number in the locale they are given, and read it back in that locale: `40,0K` and `2,5x` in `de-DE`, where both were `en-US` in every locale.

`formatCompact(value, decimals, locale)` takes the locale as a third argument, `en-US` by default. The `K`/`M`/`B`/`T` suffix stays as it is in every locale, since `parseNumber` reads it and `Intl`'s own compact words (`2 Mio.`) would not read back.

<!-- entry: api behavior -->
