---
'@weasel-js/path-tools': patch
---

Every path effect's create action reads `hideSources` from its params, so Blend, Bend Along, and Repeat Along can
hide their sources when made, and Text Along Path can be told to leave them shown. The edit action still ignores it.
