---
'@weasel-js/ui': patch
---

An empty `label` or `description` (`null`, `false` or `''`) on `Field` and the boxed form controls draws nothing, as an empty `error` does.

The control is no longer named or described by an empty element.

Inside a `Field`, a control given an empty `label` of its own takes the field's label.

<!-- entry: fix -->
