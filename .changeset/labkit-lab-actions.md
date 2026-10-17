---
'@weasel-js/labkit': patch
---

A lab has one actions registry. The header's zoom runs in it as `lab.zoom`, one action with in, out and actual-size variants, and a command a lab registers with `useCommand` from `<Lab>`'s children runs from its keys. `<LabZoom>` still works outside a `<Lab>`, bringing a registry of its own.
