---
'@weasel-js/quantity': minor
---

`fieldLocale(locale)` is exported: the locale a number field can show and read in, given the one asked for.

It keeps the locale where every number it writes reads back as that number, else writes it with Latin digits (`-u-nu-latn`), else falls back to `en-US`, which is also what no locale, or a tag `Intl` refuses, gets.

<!-- entry: api -->
