---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: renaming or moving a pref now carries every path another pref holds to it, where before only an alias followed. A `pair` naming the pref, and a `field` pref whose default names it, kept the old path and pointed at nothing. Renaming or moving a section no longer rewrites aliases of prefs whose path happens to start with the section's key: a section's key is no part of a value's path.
