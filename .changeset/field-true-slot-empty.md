---
'@weasel-js/ui': patch
---

A `Field` given `true` for its `label`, `description` or `error`, as `error={valid || 'Invalid value'}` does when the value is valid, treats it as empty, drawing nothing and leaving its control valid.

<!-- entry: fix -->
