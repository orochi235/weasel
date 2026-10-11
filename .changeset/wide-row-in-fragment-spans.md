---
'@weasel-js/ui': patch
---

In a `PrefsForm` rail with `rowsAcross={2}`, a list, object, `block`, or `label` leaf inside an `as: 'fragment'` group took one column beside its neighbor, where the same leaf outside a fragment spans both. It now spans both there too.
