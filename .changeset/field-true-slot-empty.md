---
'@weasel-js/ui': patch
---

A `Field` treats `true` in its `label`, `description` or `error` as empty, leaving its control valid.

So `error={valid || 'Invalid value'}` draws no error for a valid value.

<!-- entry: fix -->
