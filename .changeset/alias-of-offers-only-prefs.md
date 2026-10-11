---
'@weasel-js/ui': patch
---

In `PrefSchemaEditor`, an alias's `Of` picker offered every field, including the fields inside an `object` leaf and the alias itself, none of which an alias can show. It now offers only what the alias would resolve to a pref through.
