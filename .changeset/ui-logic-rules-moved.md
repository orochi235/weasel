---
"@weasel-js/ui-logic": patch
---

`@weasel-js/ui-logic` no longer exports the key and pointer rules; import them from `@weasel-js/ui-input`.

Breaking: every export but the measure/draw contract (`HeadlessComponent`, `measureButton`, `measureRowList` and what they read), `pressStep`, `listMode`, `dropSide` and `FocusScope` has moved, under the same name. `@weasel-js/ui-logic` no longer depends on `@weasel-js/quantity`.

<!-- entry: breaking -->
