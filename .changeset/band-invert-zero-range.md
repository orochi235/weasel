---
'@weasel-js/plot': patch
---

`bandScale(...).invert` on a zero-width range answers the first key, where every band sits. It used to answer `undefined`, which its docs promise only for an empty domain.
