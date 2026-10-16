---
"@weasel-js/labkit": patch
---

A control panel's text fields wait `params.lab.textWaitMs` from kit settings before writing, where a
provider sets it; a field's own `debounceMs` still wins.
