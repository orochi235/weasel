---
"@weasel-js/diagram": patch
---

A `registerOutline` disposer removes only its own registration: run twice, it no longer drops a later registration of the same name, and of one definition registered twice it takes out its own.

<!-- entry: fix -->
