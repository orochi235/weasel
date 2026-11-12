---
'@weasel-js/ui': minor
---

Number fields show and read numbers in the user's locale: `2,5` and `1.500` in German, where they were always `en-US`.

`UnitField` takes a `locale` prop. Without one it follows React Aria's locale, the same one its `NumberField` already used: the nearest `<I18nProvider locale>`, else the browser's language, else `en-US`. `PropertyPanel`'s number controls, their read-only readouts and the menu's number rows follow it too, so one `<I18nProvider>` sets every number field. A locale whose numbers would not read back as shown falls back to Latin digits, then to `en-US`; `useFieldLocale(locale?)` gives the locale a field settles on, for a consumer's own field.

<!-- entry: rank=10 new api behavior -->
