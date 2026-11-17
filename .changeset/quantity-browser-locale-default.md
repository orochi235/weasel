---
'@weasel-js/quantity': minor
'@weasel-js/menu': minor
---

A number shown with no locale given is written in the browser's language, and `en-US` where there is no browser.

`present`, `qty`, `parseAs`, `formatNumber`, `formatCompact`, `parseNumber` and `menuNumberText` used to default to `en-US`; they now default to `defaultLocale()`, a new export: `navigator.language` narrowed by `fieldLocale` to one whose numbers read back as shown. Text written to be saved or read by a program passes `{ locale: 'en-US' }` itself.

<!-- entry: rank=10 api behavior -->
