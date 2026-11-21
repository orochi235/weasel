---
'@weasel-js/prefs': patch
---

A stored split value split by a selector the schema lacks reads as the leaf does with nothing stored, its `defaultScope` included. An `auto.value` split that way reads nothing while auto, never the leaf's `default`.

<!-- entry: fix -->
