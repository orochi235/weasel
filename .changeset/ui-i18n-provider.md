---
'@weasel-js/ui': minor
---

`@weasel-js/ui` exports `I18nProvider`, which sets the locale of every number field under it.

It is React Aria's own, from the copy these components read. One imported from a `react-aria-components` of another version keeps a locale of its own, which the fields never see. The package README now says how number fields pick their locale.

<!-- entry: api -->
