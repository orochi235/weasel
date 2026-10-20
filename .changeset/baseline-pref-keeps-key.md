---
"@weasel-js/ui": patch
---

`PrefSchemaEditor` no longer rekeys a pref from the baseline when its name changes, even one whose key was its old name in camelCase, since values may be stored under that key. Renaming one now shows in Changes, and reaches `onSubmit`, as a change of its `name` alone. A node added since the baseline still takes its key from its name, and the Key field still changes any node's key on purpose.
