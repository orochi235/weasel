---
"@weasel-js/ui": patch
---

`PrefSchemaEditor`'s attributes set Name above Key, and the key follows the name: when the Name field loses focus, the key becomes the name in camelCase (`Line width` gives `lineWidth`), numbered if a sibling holds it. A node that was in the schema the editor opened on keeps its key unless the key already was its old name's, since values may be stored under it. A pref in a node property schema, whose key is its whole value path, is never rekeyed.
