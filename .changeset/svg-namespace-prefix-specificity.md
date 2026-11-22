---
'@weasel-js/svg': patch
---

A stylesheet selector's namespace prefix (`svg|rect`) adds no specificity, as Selectors 4 says, so it no longer outranks an equal rule written after it.

<!-- entry: fix -->
