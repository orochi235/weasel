---
'@weasel-js/prefs': minor
---

`@weasel-js/prefs` re-exports its schema from `@weasel-js/pref-schema`, and every import from it works as before

The builders, types and helpers moved to `@weasel-js/pref-schema` and prefs re-exports each by name, so nothing changes for code importing from `@weasel-js/prefs`. Its root also exports `PresetDescription` now, beside `@weasel-js/prefs/edit`.

<!-- entry: api -->
