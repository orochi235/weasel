---
'@weasel-js/labkit': patch
---

An `inDialog` body's `update`, `drafts` and `each` read and write the dialog's draft, so Cancel drops every edit made through them.

<!-- entry: fix -->
