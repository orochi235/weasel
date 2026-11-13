---
'@weasel-js/theme': minor
---

`themePrefsSchema`'s tokens start auto at what the theme resolves them to, its axes are always pinned, and each token page is resettable.

A token's `auto` is `{ on: true, value }`, its value split along the axes it differs by; its `default` is that value with no axis set. An axis declares no `auto`.

<!-- entry: behavior -->
