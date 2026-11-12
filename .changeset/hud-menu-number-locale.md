---
'@weasel-js/hud': minor
'@weasel-js/menu': minor
---

A hud menu's number rows write their value in the browser's locale, as a `@weasel-js/ui` number field beside them would: `2,5` in German.

`attachMenuHost` and `createMenuWidget` take a `locale` option to name another, and `menuNumberText(value, entry, locale)` takes one as a third argument, `en-US` by default.

<!-- entry: api behavior -->
