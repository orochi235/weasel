---
'@weasel-js/core': minor
---

`present.go` reaches a page whose id is `'first'` or `'last'`; a `PageRequest` names an end as `{ end: 'first' | 'last' }`.

`{ to: 'first' }` still goes to the first page where no page has that id.

<!-- entry: api fix -->
