---
"@weasel-js/ui": patch
---

A prefs rail no longer shows a blank entry for loose root-level prefs when the schema's root has no `name`: the entry, and the pane it opens, read "General" instead.

A prefs row's control takes 60% of the row (at least 110px) instead of a fixed 110px, so in a wide pane the field grows rather than the gap before it. A long label still pushes it narrower.

New `PrefKindBadge` draws a pref leaf's kind as a badge, each built-in kind in its own color from the theme's code tokens. Custom kinds are drawn muted. `PrefSchemaEditor`'s structure tree uses it, and its structure and attributes columns are now resizable from handles between the columns.
