---
'@weasel-js/quantity': patch
---

Typed text reads in the display's locale. `parseNumber` takes a locale, and every display kind passes its own, so what a display shows in `de-DE` (`1.234,5`), `fr-FR` (`1 234,5`), `de-CH` (`1'234.5`) or `en-IN` (`12,34,567`) parses back to the same value. A locale that groups with a space accepts any space there, and `'` and `’` stand in for each other. Where the locale's reading fails the `en-US` one is tried, so `1.5` is still one and a half in `de-DE`; where both succeed, the locale's wins.

A compound unit value reads a grouped number in any term: `1,500ft 3in` is 18,003 inches, where it used to be NaN.
